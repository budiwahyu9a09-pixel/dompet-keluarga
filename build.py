"""Build the GitHub Pages site: src/app.html + web/host.js -> dist/index.html"""
import pathlib, shutil
root = pathlib.Path(__file__).parent
dist = root / 'dist'
shutil.rmtree(dist, ignore_errors=True); dist.mkdir()
app = (root / 'src/app.html').read_text(encoding='utf-8')
host = (root / 'web/config.js').read_text(encoding='utf-8') + '\n' + (root / 'web/host.js').read_text(encoding='utf-8')
head_extra = ('<meta name="theme-color" content="#cfe0ff">\n'
              '<link rel="manifest" href="manifest.webmanifest">\n'
              '<link rel="icon" href="icon-192.png">\n'
              '<link rel="apple-touch-icon" href="icon-192.png">\n'
              '<meta name="apple-mobile-web-app-capable" content="yes">\n')
marker = '<script>\n(() => {'
assert marker in app, 'app script marker not found'
app = app.replace('</title>', '</title>\n' + head_extra, 1)
app = app.replace('<title>Keuangan Rumah Tangga</title>', '<title>Dompet Keluarga</title>', 1)
app = app.replace(marker,
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n'
    '<script>\n' + host + '\n</script>\n' + marker, 1)
(dist / 'index.html').write_text(app, encoding='utf-8')
for f in (root / 'web/static').iterdir():
    shutil.copy(f, dist / f.name)
(dist / '.nojekyll').write_text('')
print('built', dist / 'index.html')
