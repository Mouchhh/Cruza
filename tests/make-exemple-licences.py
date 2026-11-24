# Génère tests/exemple-licences.pdf : python3 tests/make-exemple-licences.py tests/exemple-licences.pdf
# PDF fictif façon « liste licences match » : joueurs inventés, photos dessinées (aucun vrai visage).
import sys, zlib

out = sys.argv[1]
players = [  # nom, prénom, licence, catégorie, couleur de fond (ou None = pas de photo)
    ("MARTIN", "Léo", "9000000001", "U16", (40, 85, 162)),
    ("PETIT", "Inès", "9000000003", "U16", (190, 70, 60)),
    ("ROUSSEAU", "Noé", "9000000007", "U16", None),
    ("GARCIA", "Lucas", "9000000014", "U18", (40, 140, 90)),
]

def picture(bg, w=60, h=75):
    rows = []
    for y in range(h):
        row = bytearray()
        for x in range(w):
            head = ((x - w / 2) / 16) ** 2 + ((y - 28) / 19) ** 2 <= 1
            body = y > 52 and abs(x - w / 2) < 24
            row += bytes((235, 215, 190) if head else (240, 240, 240) if body else bg)
        rows.append(bytes(row))
    return w, h, zlib.compress(b"".join(rows))

def text(s):
    return "(" + s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ")"

objects, content, images = [], [], []
content.append("BT /F1 14 Tf 40 800 Td " + text("Liste des licences - club fictif") + " Tj ET")
content.append("q 15 0 0 15 540 795 cm /Logo Do Q")  # petit logo : doit être ignoré
header_y = 760
for x, label in [(100, "Nom"), (230, "Prénom"), (360, "N° licence"), (470, "Catégorie")]:
    content.append(f"BT /F1 10 Tf {x} {header_y} Td {text(label)} Tj ET")
for i, (nom, prenom, licence, cat, bg) in enumerate(players):
    y = 700 - i * 70
    for x, value in [(100, nom), (230, prenom), (360, licence), (470, cat)]:
        content.append(f"BT /F1 10 Tf {x} {y} Td {text(value)} Tj ET")
    if bg:
        name = f"Im{i}"
        images.append((name, picture(bg)))
        content.append(f"q 40 0 0 50 40 {y - 22} cm /{name} Do Q")

stream = "\n".join(content).encode("cp1252")
def add(body):
    objects.append(body)
    return len(objects)

catalog = add(None); pages = add(None); page = add(None)
font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
contents = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
xobjects = []
lw, lh, ldata = picture((230, 180, 40), 12, 12)
logo = add(b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n" % (lw, lh, len(ldata)) + ldata + b"\nendstream")
xobjects.append(f"/Logo {logo} 0 R")
for name, (w, h, data) in images:
    ref = add(b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n" % (w, h, len(data)) + data + b"\nendstream")
    xobjects.append(f"/{name} {ref} 0 R")
objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages} 0 R >>".encode()
objects[pages - 1] = f"<< /Type /Pages /Kids [{page} 0 R] /Count 1 >>".encode()
objects[page - 1] = (f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 595 842] /Contents {contents} 0 R "
                     f"/Resources << /Font << /F1 {font} 0 R >> /XObject << {' '.join(xobjects)} >> >> >>").encode()

pdf = bytearray(b"%PDF-1.4\n")
offsets = []
for n, body in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf += b"%d 0 obj\n" % n + body + b"\nendobj\n"
xref = len(pdf)
pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
for o in offsets:
    pdf += b"%010d 00000 n \n" % o
pdf += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, catalog, xref)
open(out, "wb").write(pdf)
print("ok", len(pdf), "octets")
