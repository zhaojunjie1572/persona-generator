#!/usr/bin/env python3
import http.server
import socketserver
import urllib.request
import urllib.error
import json
from http.server import SimpleHTTPRequestHandler

class ProxyHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version')
        self.send_header('Access-Control-Max-Age', '3600')
        self.end_headers()
    
    def do_POST(self):
        if self.path.startswith('/minimax-api/'):
            self.proxy_request()
        else:
            super().do_POST()
    
    def do_GET(self):
        if self.path.startswith('/minimax-api/'):
            self.proxy_request()
        else:
            super().do_GET()
    
    def proxy_request(self):
        # Remove the /minimax-api prefix
        target_path = self.path[len('/minimax-api'):]
        target_url = f'https://api.minimaxi.com{target_path}'
        
        print(f"Proxying to: {target_url}")
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None
        
        if body:
            print(f"Request body: {body.decode('utf-8', errors='ignore')}")
        
        # Create request
        req = urllib.request.Request(target_url, data=body, method=self.command)
        
        # Copy headers
        for header_name, header_value in self.headers.items():
            if header_name.lower() not in ['host', 'content-length']:
                req.add_header(header_name, header_value)
                print(f"Request header: {header_name}: {header_value}")
        
        try:
            # Send request
            print("Sending request to MiniMax...")
            with urllib.request.urlopen(req, timeout=120) as response:
                print(f"Response status: {response.status}")
                
                # Send response
                self.send_response(response.status)
                
                # Copy response headers
                for header_name, header_value in response.headers.items():
                    if header_name.lower() not in ['transfer-encoding', 'content-encoding']:
                        self.send_header(header_name, header_value)
                        print(f"Response header: {header_name}: {header_value}")
                
                # Add CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version')
                
                self.end_headers()
                
                # Send response body
                response_body = response.read()
                print(f"Response body (truncated): {response_body[:500]}")
                self.wfile.write(response_body)
                
        except urllib.error.HTTPError as e:
            print(f"HTTP Error: {e.code}")
            error_body = e.read()
            print(f"Error body: {error_body}")
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_body)
        except Exception as e:
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

def main():
    PORT = 3000
    Handler = ProxyHTTPRequestHandler
    
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(('', PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print(f"Proxying /minimax-api/* to https://api.minimaxi.com")
        httpd.serve_forever()

if __name__ == '__main__':
    main()
