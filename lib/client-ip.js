'use strict';
const proxyaddr = require('proxy-addr');
const net = require('net');
function createClientIp(env = process.env) {
  const setting = env.TRUST_PROXY;
  if (setting !== undefined && setting !== '') {
    if (!/^\d+$/.test(setting) || Number(setting) > 20) throw new Error('TRUST_PROXY must be a whole number from 0 to 20.');
    const hops = Number(setting);
    return req => proxyaddr(req, (_address, index) => index < hops);
  }
  if (env.RAILWAY_SERVICE_ID) return req => {
    const ip = req.get('X-Real-IP');
    return ip && net.isIP(ip) ? ip : req.socket.remoteAddress;
  };
  return req => req.socket?.remoteAddress || req.ip;
}
module.exports = { createClientIp };
