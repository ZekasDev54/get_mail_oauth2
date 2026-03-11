import http.server
import socketserver
import os
import json
import urllib.request
import urllib.error
import ssl

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api_proxy':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            target_url = "https://tools.dongvanfb.net/api/get_messages_oauth2"
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            try:
                # Bypass SSL verification if needed (common in local but good for safety)
                context = ssl._create_unverified_context()
                
                req = urllib.request.Request(target_url, data=post_data, headers=headers, method='POST')
                with urllib.request.urlopen(req, context=context, timeout=30) as response:
                    res_status = response.getcode()
                    res_body = response.read().decode()
                    
                    self.send_response(res_status)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(res_body.encode())
                    
            except urllib.error.HTTPError as e:
                error_body = e.read().decode()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(error_body.encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": False, "message": str(e)}).encode())
        else:
            super().do_POST()

# Deployment configuration
PORT = int(os.environ.get("PORT", 8000))
# Bind to 0.0.0.0 is mandatory for cloud hosting
HANDLER = MyHandler

with socketserver.TCPServer(("0.0.0.0", PORT), HANDLER) as httpd:
    print(f"Cloud-ready Server started at port {PORT}")
    
    # Only open browser if running locally (not on Render/Heroku)
    if not os.environ.get("RENDER") and not os.environ.get("PORT"):
        import webbrowser
        import threading
        def open_browser():
            import time
            time.sleep(1)
            print(f"Opening browser at http://localhost:{PORT}")
            webbrowser.open(f"http://localhost:{PORT}")
        threading.Thread(target=open_browser).start()
        
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
