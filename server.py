#!/usr/bin/env python3
import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os

PORT = int(os.environ.get('PORT', 3000))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

class ServerHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()

    def do_POST(self):
        if '/v1/chat/completions' in self.path:
            self.proxy_deepseek()
        elif '/v1/messages' in self.path:
            self.proxy_minimax()
        else:
            self.send_error(404, 'Not Found')

    def proxy_deepseek(self):
        target_url = 'https://api.deepseek.com' + self.path.replace('/api', '')
        self.proxy_request(target_url)

    def proxy_minimax(self):
        target_url = 'https://api.minimaxi.chat' + self.path.replace('/api', '')
        self.proxy_request(target_url)

    def proxy_request(self, target_url):
        print(f'Proxying to: {target_url}')

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        req = urllib.request.Request(target_url, data=body, method='POST')
        req.add_header('Content-Type', 'application/json')

        auth = self.headers.get('Authorization')
        if auth:
            req.add_header('Authorization', auth)

        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response.read())

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())

        except Exception as e:
            print(f'Error: {e}')
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def send_head(self):
        """Serve static files"""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')

        try:
            f = open(path, 'rb')
        except IOError:
            self.send_error(404, 'File not found')
            return None

        ctype = self.guess_type(path)
        self.send_response(200)
        self.send_header('Content-type', ctype)
        self.send_header('Access-Control-Allow-Origin', '*')
        fs = os.fstat(f.fileno())
        self.send_header('Content-Length', str(fs[6]))
        self.send_header('Last-Modified', self.date_time_string(fs.st_mtime))
        self.end_headers()
        return f

    def translate_path(self, path):
        """Translate URL path to filesystem path"""
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        path = path.replace('/api', '')
        return os.path.join(STATIC_DIR, path.lstrip('/'))

    def log_message(self, format, *args):
        print(f'{self.address_string()} - [{self.log_date_time_string()}] {format % args}')

def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), ServerHandler) as httpd:
        print(f'Server running on port {PORT}')
        print(f'Serving static files from {STATIC_DIR}')
        httpd.serve_forever()

if __name__ == '__main__':
    main()
