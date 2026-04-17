#!/usr/bin/env python3
import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os

PORT = int(os.environ.get('PORT', 3000))

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()

    def do_POST(self):
        self.proxy_request()

    def do_GET(self):
        self.serve_static()

    def proxy_request(self):
        path = self.path
        print(f'Proxy request: {path}')

        # Determine target URL based on path
        if '/v1/chat/completions' in path:
            target_url = 'https://api.deepseek.com' + path
        elif '/v1/messages' in path:
            target_url = 'https://api.minimaxi.chat' + path
        else:
            self.send_error(404, 'Not Found')
            return

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Create proxy request
        req = urllib.request.Request(target_url, data=body, method='POST')
        req.add_header('Content-Type', 'application/json')

        # Copy authorization header
        auth = self.headers.get('Authorization')
        if auth:
            req.add_header('Authorization', auth)

        # Add other headers
        for header in ['Content-Length', 'anthropic-version']:
            value = self.headers.get(header)
            if value and header not in req.headers:
                req.add_header(header, value)

        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                response_body = response.read()
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', len(response_body))
                self.end_headers()
                self.wfile.write(response_body)
                print(f'Proxy success: {response.status}')

        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', len(error_body))
            self.end_headers()
            self.wfile.write(error_body)
            print(f'Proxy HTTP error: {e.code}')

        except Exception as e:
            print(f'Proxy error: {e}')
            error_json = json.dumps({'error': str(e)}).encode()
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(error_json))
            self.end_headers()
            self.wfile.write(error_json)

    def serve_static(self):
        """Serve static files - for health check and fallback"""
        # Remove query parameters from path
        path = self.path.split('?')[0]
        
        if path == '/' or path == '/index.html':
            path = '/index.html'

        static_file = path.lstrip('/')
        static_dir = os.path.dirname(os.path.abspath(__file__))

        # Security: prevent directory traversal
        if '..' in static_file:
            self.send_error(403, 'Forbidden')
            return

        file_path = os.path.join(static_dir, static_file)

        if os.path.isdir(file_path):
            file_path = os.path.join(file_path, 'index.html')

        if os.path.isfile(file_path):
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                if file_path.endswith('.html'):
                    self.send_header('Content-Type', 'text/html')
                elif file_path.endswith('.js'):
                    self.send_header('Content-Type', 'application/javascript')
                elif file_path.endswith('.css'):
                    self.send_header('Content-Type', 'text/css')
                elif file_path.endswith('.json'):
                    self.send_header('Content-Type', 'application/json')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', len(content))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                print(f'Error serving file: {e}')
                self.send_error(500, 'Server Error')
        else:
            # Fallback to index.html for SPA routing
            index_path = os.path.join(static_dir, 'index.html')
            if os.path.isfile(index_path):
                try:
                    with open(index_path, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', len(content))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(content)
                except:
                    self.send_error(500, 'Server Error')
            else:
                self.send_error(404, 'Not Found')

    def log_message(self, format, *args):
        print(f'[{self.log_date_time_string()}] {format % args}')

def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), ProxyHandler) as httpd:
        print(f'Server running on http://0.0.0.0:{PORT}')
        httpd.serve_forever()

if __name__ == '__main__':
    main()
