// Tiny MQTT 3.1.1 over WebSocket client for Viewing Party sync.
// No server or accounts: devices meet on a public relay under a topic made from the party code.
(function () {
  var BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  var enc = new TextEncoder(), dec = new TextDecoder();

  function str(s) { var b = enc.encode(s); return [b.length >> 8, b.length & 255].concat(Array.from(b)); }
  function packet(type, body) {
    var len = body.length, hdr = [type];
    do { var d = len % 128; len = Math.floor(len / 128); if (len > 0) d |= 128; hdr.push(d); } while (len > 0);
    return new Uint8Array(hdr.concat(body));
  }

  function PartyNet(topic, onMessage, onStatus) {
    this.topic = topic; this.onMessage = onMessage; this.onStatus = onStatus || function () {};
    this.broker = 0; this.ws = null; this.ready = false; this.closed = false; this.queue = []; this.buf = new Uint8Array(0);
    this.retry = 0; this.connect();
  }
  PartyNet.prototype.connect = function () {
    var self = this;
    if (self.closed) return;
    var ws;
    try { ws = new WebSocket(BROKERS[self.broker], ['mqtt']); } catch (e) { return self.fail(); }
    ws.binaryType = 'arraybuffer';
    self.ws = ws; self.ready = false; self.buf = new Uint8Array(0);
    self.onStatus('connecting');
    var opened = false;
    var timer = setTimeout(function () { if (!self.ready) { try { ws.close(); } catch (e) {} } }, 8000);
    ws.onopen = function () {
      opened = true;
      var id = 'dfx' + Math.random().toString(36).slice(2, 12);
      // protocol "MQTT", level 4, clean session, keepalive 30s
      ws.send(packet(0x10, str('MQTT').concat([4, 2, 0, 30]).concat(str(id))));
    };
    ws.onmessage = function (e) { self.feed(new Uint8Array(e.data)); };
    ws.onclose = function () {
      clearTimeout(timer); clearInterval(self.ping);
      var was = self.ready; self.ready = false; self.ws = null;
      if (self.closed) return;
      self.onStatus('reconnecting');
      if (!opened || !was) self.broker = (self.broker + 1) % BROKERS.length; // try another relay
      self.fail();
    };
    ws.onerror = function () {};
  };
  PartyNet.prototype.fail = function () {
    var self = this; if (self.closed) return;
    self.retry = Math.min(self.retry + 1, 5);
    setTimeout(function () { self.connect(); }, 600 * self.retry);
  };
  PartyNet.prototype.feed = function (chunk) {
    var b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    while (this.buf.length >= 2) {
      var mult = 1, len = 0, i = 1, d;
      do { if (i >= this.buf.length) return; d = this.buf[i++]; len += (d & 127) * mult; mult *= 128; } while (d & 128);
      if (this.buf.length < i + len) return;
      var type = this.buf[0] >> 4, body = this.buf.subarray(i, i + len);
      this.buf = this.buf.slice(i + len);
      this.handle(type, body);
    }
  };
  PartyNet.prototype.handle = function (type, body) {
    var self = this;
    if (type === 2) { // CONNACK
      if (body[1] !== 0) { try { self.ws.close(); } catch (e) {} return; }
      self.ws.send(packet(0x82, [0, 1].concat(str(self.topic)).concat([0]))); // SUBSCRIBE qos0
    } else if (type === 9) { // SUBACK
      self.ready = true; self.retry = 0;
      self.ping = setInterval(function () { if (self.ws && self.ready) self.ws.send(new Uint8Array([0xC0, 0])); }, 20000);
      self.onStatus('online');
      var q = self.queue; self.queue = []; q.forEach(function (m) { self.send(m); });
    } else if (type === 3) { // PUBLISH
      var tl = (body[0] << 8) | body[1];
      var payload = dec.decode(body.subarray(2 + tl));
      try { self.onMessage(JSON.parse(payload)); } catch (e) {}
    }
  };
  PartyNet.prototype.send = function (obj) {
    if (!this.ready || !this.ws) { this.queue.push(obj); if (this.queue.length > 5) this.queue.shift(); return; }
    var p = Array.from(enc.encode(JSON.stringify(obj)));
    this.ws.send(packet(0x30, str(this.topic).concat(p)));
  };
  PartyNet.prototype.close = function () {
    this.closed = true; clearInterval(this.ping);
    if (this.ws) { try { this.ws.send(new Uint8Array([0xE0, 0])); this.ws.close(); } catch (e) {} }
  };
  window.PartyNet = PartyNet;
})();
