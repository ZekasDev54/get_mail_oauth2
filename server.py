import http.server
import socketserver
import os
import json
import requests
import urllib.parse

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
            
            # Giả lập Header một cách tự nhiên nhất
            headers = {
                'Host': 'tools.dongvanfb.net',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Origin': 'https://tools.dongvanfb.net',
                'Referer': 'https://tools.dongvanfb.net/get-messages-oauth2',
                'Connection': 'keep-alive'
            }
            
            try:
                # Dùng requests để handle response mạnh mẽ hơn
                # verify=False để bỏ qua lỗi SSL nếu có (thường gặp khi proxy)
                response = requests.post(target_url, data=post_data, headers=headers, timeout=60, verify=True)
                
                self.send_response(response.status_code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                self.wfile.write(response.content)
                print(f"API Forward Success: Code {response.status_code}")
                
            except requests.exceptions.RequestException as e:
                print(f"Request Error: {str(e)}")
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                err_msg = {"status": False, "message": f"Proxy Error: {str(e)}"}
                self.wfile.write(json.dumps(err_msg).encode())
        else:
            super().do_POST()

PORT = int(os.environ.get("PORT", 8000))
HANDLER = MyHandler

with socketserver.TCPServer(("0.0.0.0", PORT), HANDLER) as httpd:
    print(f"Server is running at port {PORT}")
    
    # Auto open browser only on local
    if not os.environ.get("RENDER") and not os.environ.get("PORT"):
        import webbrowser
        import threading
        def open_browser():
            import time
            time.sleep(2)
            webbrowser.open(f"http://localhost:{PORT}")
        threading.Thread(target=open_browser).start()
        
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
