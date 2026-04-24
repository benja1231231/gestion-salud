from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import cm
from datetime import datetime
import requests
from reportlab.lib.utils import ImageReader

class PDFService:
    @staticmethod
    def generar_receta(medico_nombre: str, matricula: str, paciente_nombre: str, contenido: str, firma_url: str = None) -> BytesIO:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A5)
        width, height = A5

        # Encabezado
        c.setFont("Helvetica-Bold", 16)
        c.drawString(1*cm, height - 1.5*cm, "RECETA MÉDICA")
        
        c.setFont("Helvetica", 10)
        c.drawString(1*cm, height - 2.5*cm, f"Dr/Dra: {medico_nombre}")
        c.drawString(1*cm, height - 3*cm, f"M.P.: {matricula}")
        c.line(1*cm, height - 3.5*cm, width - 1*cm, height - 3.5*cm)

        # Paciente
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1*cm, height - 4.5*cm, f"Paciente: {paciente_nombre}")
        c.setFont("Helvetica", 10)
        c.drawString(1*cm, height - 5*cm, f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")

        # Contenido (RP/)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1*cm, height - 6.5*cm, "RP/")
        
        text_object = c.beginText(1.5*cm, height - 7.5*cm)
        text_object.setFont("Helvetica", 12)
        text_object.setLeading(14)
        
        # Split contenido por líneas para el PDF
        for line in contenido.split('\n'):
            text_object.textLine(line)
        c.drawText(text_object)

        # Firma Digital (Imagen)
        if firma_url:
            try:
                print(f"DEBUG: Intentando descargar firma desde: {firma_url}")
                response = requests.get(firma_url, timeout=5)
                if response.status_code == 200:
                    img_data = BytesIO(response.content)
                    img_reader = ImageReader(img_data)
                    # Dibujar firma sobre la línea (Aumentado de 4x1.5 a 5x2.5)
                    c.drawImage(img_reader, width - 6.5*cm, 2.1*cm, width=5.5*cm, height=2.5*cm, preserveAspectRatio=True, mask='auto')
                    print("DEBUG: Firma insertada en el PDF")
                else:
                    print(f"DEBUG: Error al descargar firma. Status code: {response.status_code}")
            except Exception as e:
                print(f"DEBUG: Error procesando imagen de firma: {e}")

        # Firma (Línea y Sello)
        c.line(width - 6*cm, 2*cm, width - 1*cm, 2*cm)
        c.setFont("Helvetica", 8)
        c.drawCentredString(width - 3.5*cm, 1.6*cm, "Firma y Sello")

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer
