from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class SPARouter(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Si c'est une route /index/*, servir index.html
        if self.path.startswith('/index/'):
            self.path = '/index.html'
        return super().do_GET()

# Lancer le serveur
if __name__ == '__main__':
    os.chdir('.')
    server = HTTPServer(('localhost', 8000), SPARouter)
    print('Serveur SPA sur http://localhost:8000')
    print('URLs propres : http://localhost:8000/index/slug-de-la-categorie')
    server.serve_forever()