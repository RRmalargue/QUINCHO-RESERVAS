import urllib.request
import json
import re
import os
import sys

def parse_ics(ics_content):
    events = []
    current_event = {}
    in_event = False
    
    # Expresiones regulares para extraer datos
    dtstart_re = re.compile(r'^DTSTART(?:;VALUE=DATE|;TZID=[\w/]+)?:(\d{8})(?:T(\d{6})Z?)?')
    summary_re = re.compile(r'^SUMMARY:(.*)')
    
    lines = ics_content.splitlines()
    # Unir líneas que están divididas (la especificación ICS permite continuar líneas con un espacio al inicio)
    unfolded_lines = []
    for line in lines:
        if line.startswith(' ') or line.startswith('\t'):
            if unfolded_lines:
                unfolded_lines[-1] += line[1:]
        else:
            unfolded_lines.append(line)
            
    for line in unfolded_lines:
        line = line.strip()
        if line == 'BEGIN:VEVENT':
            current_event = {}
            in_event = True
        elif line == 'END:VEVENT':
            if in_event and 'date' in current_event:
                events.append(current_event)
            in_event = False
        elif in_event:
            # Parsear Fecha de Inicio
            if line.startswith('DTSTART'):
                m = dtstart_re.match(line)
                if m:
                    date_val = m.group(1) # YYYYMMDD
                    time_val = m.group(2) # HHMMSS (opcional)
                    
                    formatted_date = f"{date_val[0:4]}-{date_val[4:6]}-{date_val[6:8]}"
                    current_event['date'] = formatted_date
                    
                    if time_val:
                        hour = int(time_val[0:2])
                        # Determinar turno según hora (hora local / UTC simplificada)
                        if 8 <= hour < 19:
                            current_event['slots'] = ['day']
                        else:
                            current_event['slots'] = ['night']
                    else:
                        # Si no hay hora, es todo el día
                        current_event['slots'] = ['day', 'night']
            # Parsear Título
            elif line.startswith('SUMMARY:'):
                m = summary_re.match(line)
                if m:
                    current_event['summary'] = m.group(1).replace('\\,', ',').replace('\\;', ';')
                    
    return events

def main():
    if len(sys.argv) < 2:
        print("ERROR: Debes proporcionar el Calendar ID o la URL pública de iCal.")
        sys.exit(1)
        
    target = sys.argv[1]
    if target.startswith('http'):
        url = target
    else:
        # Reconstruir URL pública de Google Calendar iCal
        url = f"https://calendar.google.com/calendar/ical/{urllib.parse.quote(target)}/public/basic.ics"
        
    print(f"Descargando eventos desde: {url}")
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            ics_content = response.read().decode('utf-8')
    except Exception as e:
        print(f"ERROR al descargar el archivo: {e}")
        print("Por favor, asegúrate de que el calendario de Google sea PÚBLICO en la configuración.")
        sys.exit(1)
        
    gcal_events = parse_ics(ics_content)
    print(f"Se encontraron {len(gcal_events)} eventos válidos en Google Calendar.")
    
    # Cargar reservas actuales
    bookings_path = "bookings.json"
    if os.path.exists(bookings_path):
        with open(bookings_path, "r", encoding="utf-8") as f:
            try:
                bookings = json.load(f)
            except Exception:
                bookings = []
    else:
        bookings = []
        
    # Filtrar reservas previas que hayan venido de Google Calendar para no duplicar
    original_len = len(bookings)
    bookings = [b for b in bookings if b.get('phone') != 'GCal']
    print(f"Reservas locales originales: {original_len}. Limpiando importaciones previas de Google.")
    
    # Agregar las nuevas reservas importadas
    added_count = 0
    for event in gcal_events:
        date = event['date']
        summary = event.get('summary', 'Reserva (GCal)')
        for slot in event['slots']:
            # Evitar colisión con una reserva manual ya existente
            exists = any(b for b in bookings if b['date'] == date and b['slot'] == slot)
            if not exists:
                bookings.append({
                    "date": date,
                    "slot": slot,
                    "name": f"[GCal] {summary}",
                    "phone": "GCal",
                    "totalPrice": 0,
                    "deposit": 0
                })
                added_count += 1
                
    # Guardar en bookings.json
    with open(bookings_path, "w", encoding="utf-8") as f:
        json.dump(bookings, f, indent=2, ensure_ascii=False)
        
    print(f"Sincronización exitosa: Se agregaron {added_count} turnos nuevos a bookings.json.")
    print("Por favor, sube el archivo 'bookings.json' actualizado a tu repositorio de GitHub para publicar los cambios.")

if __name__ == '__main__':
    main()
