import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { setTimeout as setNodeTimeout, clearTimeout as clearNodeTimeout } from 'node:timers';
import { abortError, type Transport } from './core';

/** Desktop Node transport: no browser CORS, abortable, no cross-host redirects. */
export const desktopTransport: Transport = (input, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(abortError()); return; }
  const url = new URL(input.url);
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  let settled = false;
  let timer: ReturnType<typeof setNodeTimeout> | undefined;
  const finish = (error?: Error, response?: { status: number; text: string }) => {
    if (settled) return;
    settled = true;
    clearNodeTimeout(timer);
    signal.removeEventListener('abort', cancel);
    if (error) reject(error); else resolve(response!);
  };
  const request = send(url, {
    method: input.method ?? 'POST',
    headers: { ...input.headers, ...(input.method === 'GET' ? {} : { 'Content-Length': Buffer.byteLength(input.body) }) },
  }, (response) => {
    const chunks: Buffer[] = [];
    let length = 0;
    response.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > 2 * 1024 * 1024) {
        finish(new Error('接口响应超过 2 MB，已停止接收。'));
        response.destroy();
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => finish(undefined, { status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
    response.on('error', () => finish(new Error('接收响应时连接中断，请重试。')));
    response.on('aborted', () => finish(new Error('服务商提前断开连接，请重试。')));
  });
  const cancel = () => { finish(abortError()); request.destroy(); };
  request.on('error', (error: NodeJS.ErrnoException) => {
    const message = error.code === 'ENOTFOUND' ? '找不到接口域名，请检查地址和网络。'
      : error.code === 'ECONNREFUSED' ? '连接被拒绝，请检查地址、端口和本地模型服务。'
      : /CERT|TLS|SSL/.test(error.code ?? '') ? '接口 TLS 证书校验失败，请检查服务商证书。'
      : '网络连接失败，请检查网络和接口地址。';
    finish(new Error(message));
  });
  signal.addEventListener('abort', cancel, { once: true });
  timer = setNodeTimeout(() => {
    finish(new Error(`请求超过 ${Math.round(input.timeoutMs / 1000)} 秒，已停止等待；可以缩小选区或增加超时。`));
    request.destroy();
  }, input.timeoutMs);
  if (signal.aborted) cancel();
  else request.end(input.method === 'GET' ? undefined : input.body);
});
