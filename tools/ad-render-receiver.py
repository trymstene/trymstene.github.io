"""Tiny CORS-enabled receiver: the browser renders banana frames from the real
engine and POSTs each PNG here; we write it to the renders dir. Local + throwaway.
RUN: python tools/ad-render-receiver.py [--dir <out>] [--port 8899]
"""
import argparse
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ad-pack', 'renders-rave'))
ap.add_argument('--port', type=int, default=8899)
args = ap.parse_args()
os.makedirs(args.dir, exist_ok=True)
print('receiver writing to', args.dir)


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get('name') or ['frame'])[0]
        name = ''.join(c for c in name if c.isalnum() or c in '-_')  # sanitise
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        with open(os.path.join(args.dir, name + '.png'), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


ThreadingHTTPServer(('127.0.0.1', args.port), H).serve_forever()
