from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import cm
from datetime import datetime
import requests
from reportlab.lib.utils import ImageReader

class PDFService:
    @staticmethod
    def generar_receta(
        medico_nombre: str, 
        matricula: str, 
        paciente_nombre: str, 
        contenido: str, 
        firma_url: str = None,
        especialidad: str = None,
        matricula_especialidad: str = None,
        telefono_consultorio: str = None,
        direccion_consultorio: str = None,
        paciente_dni: str = None,
        paciente_fecha_nac: str = None,
        paciente_os: str = None,
        paciente_nro_afiliado: str = None
    ) -> BytesIO:
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A5)
        width, height = A5

        # --- ENCABEZADO MÉDICO --- 
        c.setFont("Helvetica-Bold", 11)
        c.drawString(1*cm, height - 2.5*cm, f"Dr/Dra: {medico_nombre}")
        
        c.setFont("Helvetica", 9)
        info_medico = f"Especialidad: {especialidad or 'General'}"
        if matricula_especialidad:
            info_medico += f" | M.E.: {matricula_especialidad}"
        c.drawString(1*cm, height - 3.0*cm, info_medico)
        c.drawString(1*cm, height - 3.5*cm, f"M.P.: {matricula}")
        
        if direccion_consultorio or telefono_consultorio:
            contacto = f"Dir: {direccion_consultorio or '-'}"
            if telefono_consultorio:
                contacto += f" | Tel: {telefono_consultorio}"
            c.setFont("Helvetica-Oblique", 8)
            c.drawString(1*cm, height - 4.0*cm, contacto)

        c.line(1*cm, height - 4.3*cm, width - 1*cm, height - 4.3*cm)

        # --- DATOS PACIENTE ---
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*cm, height - 5.0*cm, f"Paciente: {paciente_nombre}")
        
        c.setFont("Helvetica", 9)
        # Calcular edad si hay fecha nac
        edad_str = "S/D"
        if paciente_fecha_nac:
            try:
                from datetime import date
                birth = datetime.strptime(str(paciente_fecha_nac), '%Y-%m-%d').date()
                today = date.today()
                age = today.getFullYear() - birth.getFullYear() - ((today.getMonth(), today.getDate()) < (birth.getMonth(), birth.getDate()))
                edad_str = f"{age} años"
            except:
                pass
        
        c.drawString(1*cm, height - 5.5*cm, f"DNI: {paciente_dni} | Edad: {edad_str}")
        c.drawString(1*cm, height - 6.0*cm, f"Obra Social: {paciente_os or 'Particular'} | Afiliado: {paciente_nro_afiliado or '-'}")
        c.drawString(1*cm, height - 6.5*cm, f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")

        c.line(1*cm, height - 6.8*cm, width - 1*cm, height - 6.8*cm)

        # --- CONTENIDO (RP/) ---
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1*cm, height - 8.0*cm, "RP/")
        
        text_object = c.beginText(1.5*cm, height - 9.0*cm)
        text_object.setFont("Helvetica", 11)
        text_object.setLeading(14)
        
        # Split contenido por líneas para el PDF
        for line in contenido.split('\n'):
            # Limitar longitud de línea simple para que no se salga del PDF
            if len(line) > 50:
                chunks = [line[i:i+50] for i in range(0, len(line), 50)]
                for chunk in chunks:
                    text_object.textLine(chunk)
            else:
                text_object.textLine(line)
        c.drawText(text_object)

        # --- FIRMA DIGITAL ---
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
        c.drawCentredString(width - 3.5*cm, 1.2*cm, f"Dr/Dra. {medico_nombre}")
        c.drawCentredString(width - 3.5*cm, 0.8*cm, f"M.P. {matricula}")

        c.showPage()
        c.save()
        buffer.seek(0)
        return buffer
