#!/usr/bin/env bash
# Genera imagenes con Codex image_gen, una por una, y las copia al proyecto.
OUT="E:/Altiplano al dia/public/img/ia"
D1="$APPDATA/orca/codex-runtime-home/home/generated_images"
D2="$HOME/.codex/generated_images"
STYLE="Estilo: ilustracion editorial de linea blanca fina sobre fondo azul solido #043F9B, como grabado lineal minimalista, con acentos puntuales en amarillo #FFEE00. Sin texto, sin letras, sin logotipos, sin marcas de agua. Composicion limpia y elegante para un diario digital regional de Puno, Peru."

declare -a NAMES PROMPTS
add(){ NAMES+=("$1"); PROMPTS+=("$2"); }
add portada-titicaca "Banner panoramico 16:9 del Lago Titicaca al amanecer: islas flotantes de los Uros, balsas de totora, la cordillera nevada al fondo y un sol andino escalonado (chakana) en el cielo."
add politica "Ilustracion 4:3 sobre politica regional: fachada de un edificio de gobierno con columnas en una plaza andina, la catedral de Puno al lado, banderas ondeando."
add seguridad "Ilustracion 4:3 sobre seguridad ciudadana: patrullero policial y un serenazgo en una calle de ciudad andina de noche, luces de sirena sutiles en amarillo."
add economia "Ilustracion 4:3 sobre economia regional: mercado andino con productores de quinua, papa y lana de alpaca, balanza y monedas estilizadas."
add educacion "Ilustracion 4:3 sobre educacion: estudiantes universitarios con libros frente a un campus moderno en el altiplano, un birrete y una lampara del saber."
add salud "Ilustracion 4:3 sobre salud: hospital regional moderno con cruz medica, una enfermera y un estetoscopio estilizado, montanas detras."
add sociedad "Ilustracion 4:3 sobre sociedad: familia andina caminando en una plaza con vecinos, mujeres con polleras y sombreros bombin, ninos jugando."
add cultura "Ilustracion 4:3 sobre cultura: danzante de la Diablada de la Candelaria con mascara y traje bordado, musicos con zampona y bombo."
add deportes "Ilustracion 4:3 sobre deportes: jugador de futbol pateando un balon en un estadio de altura con tribunas y montanas nevadas detras."
add ambiente "Ilustracion 4:3 sobre medio ambiente: totorales del Titicaca, una parihuana (flamenco andino), vicunas pastando y un nevado con glaciar."
add nacional "Ilustracion 4:3 sobre noticias nacionales: silueta del mapa del Peru con la region Puno destacada en amarillo, lineas de conexion hacia Lima."
add newsletter "Ilustracion cuadrada 1:1 para suscripcion a boletin: un sobre de carta abierto del que salen hojas de periodico, con una llama mirando y un sol chakana pequeno."
add error404 "Ilustracion 4:3 para pagina no encontrada: una llama confundida mirando un mapa de papel en medio del altiplano vacio, con un letrero de camino en blanco."
add radio "Ilustracion 16:9 sobre medios de comunicacion regionales: antena de radio sobre un cerro, microfono de estudio y ondas de transmision sobre la ciudad de Puno y el lago."

for i in "${!NAMES[@]}"; do
  n="${NAMES[$i]}"
  [ -f "$OUT/$n.png" ] && { echo "skip $n"; continue; }
  stamp=$(date +%s)
  echo "=== $n ($(date +%T))"
  printf '%s\n' "PASOS OBLIGATORIOS EN ESTA MISMA EJECUCION: genera exactamente una imagen PNG con la herramienta image_gen. NO termines tu turno ni respondas texto hasta haber generado el PNG. NO pidas confirmacion. Imagen: ${PROMPTS[$i]} $STYLE Genera AHORA con image_gen." \
    | timeout 420 codex exec --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox - > "$OUT/../../../scripts/log-imagenes-$n.txt" 2>&1
  f=$(find "$D1" "$D2" -name '*.png' -newermt "@$stamp" 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
  if [ -n "$f" ]; then cp "$f" "$OUT/$n.png"; echo "ok $n <- $f"; else echo "FALLO $n"; fi
done
echo DONE
