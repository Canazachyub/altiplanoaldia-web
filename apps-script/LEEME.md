# Panel de redacción — Google Sheets + Drive + Apps Script

**Qué hace cada parte**

- **Sheets** guarda los datos:
  - `Hoy`: notas del día, versión del maquetador.
  - Una hoja por día (`AAAA-MM-DD`): es el archivo.
  - `Ediciones`, `Usuarios` y `Registro`.
- **Drive** guarda las fotos, en la carpeta «Altiplano al Día — Fotos». Ahí van:
  - las fotos que sube el maquetador;
  - las que cambian los editores desde el panel.
- **Apps Script** (`Code.gs`) es el servidor. Se encarga de:
  - el ingreso con usuario y clave;
  - las ediciones;
  - los usuarios;
  - recibir lo que sube el maquetador;
  - entregar las ediciones a la web.

Las ediciones cambian **solo la web**. El boletín PDF sale como lo arma el maquetador.

## Instalación (una sola vez)

1. **Crear la hoja.** En Google Drive, crea una hoja de cálculo nueva, por ejemplo «Altiplano al Día — Noticias».
2. **Cargar el código.**
   1. Abre **Extensiones → Apps Script**.
   2. Borra lo que haya y pega el contenido de `Code.gs`.
   3. En **Configuración del proyecto**, marca «Mostrar el archivo de manifiesto».
   4. Pega `appsscript.json`.
   5. Guarda.
3. **Inicializar.**
   1. Recarga la hoja. Aparece el menú **Altiplano**; elige **Inicializar (primera vez)**.
   2. Autoriza los permisos: Sheets y Drive, todo dentro de tu cuenta.
   3. Anota los tres datos que aparecen:
      - el **usuario `admin`** y su **clave inicial**;
      - la **clave API del maquetador**.
4. **Publicar el servidor.**
   1. En Apps Script, ve a **Implementar → Nueva implementación → Aplicación web**.
   2. Configura:
      - Ejecutar como: **Yo**.
      - Quién tiene acceso: **Cualquier usuario**.
   3. Copia la URL que termina en `/exec`.
5. **Conectar el sitio.**
   1. En GitHub, abre el repositorio del sitio y ve a **Settings → Secrets and variables → Actions → Variables**.
   2. Crea la variable `SHEETS_API` con la URL `/exec`.
6. **Conectar el maquetador.**
   - En `config.json`, pon `"sheets_api": "<URL /exec>"`.
   - En el `.env`, agrega `SHEETS_CLAVE=<clave API>`.

   Nunca pegues estas claves en el chat ni las subas a GitHub.

## Uso

- **Entrar:** ve a `https://altiplanoaldia.pe/admin` y entra con el usuario `admin`. Cambia la clave en **Mi clave**.
- **Crear editores:** en **Usuarios** (solo el admin) se crean editores con usuario y clave. También se les cambia la clave y se los desactiva.
- **Editar notas:** en **Notas** se elige el día y se corrige:
  - titular, antetítulo, bajada, texto y sección;
  - la foto, que se sube a Drive;
  - ocultarla de la web.
- **Cuándo se ve un cambio:** la web lo muestra en unos 15 minutos, cuando la revisión automática de GitHub recompila. También se ve antes si el maquetador publica.

## Si cambias `Code.gs`

1. Ve a **Implementar → Gestionar implementaciones**.
2. Edita la implementación y elige **Nueva versión**.

Así la URL `/exec` no cambia.

## Pruebas (sin cuenta de Google)

En `apps-script/pruebas/` hay un simulador. Ejecuta **el mismo `Code.gs`** con Sheets, Drive, caché y propiedades de Google simulados.

- **Pruebas automáticas:** `node apps-script/pruebas/pruebas.mjs` corre 39 pruebas:
  - ingreso y bloqueo por intentos;
  - roles y usuarios;
  - ediciones y restaurar;
  - fotos en Drive;
  - archivo por días;
  - protección contra fórmulas.

  GitHub las corre antes de cada publicación y, si fallan, no publica.
- **Probar todo en local:** `node apps-script/pruebas/servidor.mjs 8787 claves.json` levanta un servidor que imita al de Google. La clave del admin y la clave API quedan en `claves.json`. Después:
  - para el sitio: `VITE_SHEETS_API=http://localhost:8787 npx vite`, y entrar a `http://localhost:5180/admin`;
  - para el maquetador: usar `sheets_api` = `http://localhost:8787`.

  Al terminar, borra `public/data/ediciones*.json` y `public/img/ediciones/` si los generaste.

## Alerta Mascota y Anuncios gratis (avisos del público)

- **Dónde se ven:** `altiplanoaldia.pe/alerta-mascota` (mascotas perdidas, encontradas, maltrato, adopción) y `altiplanoaldia.pe/anuncios` (clasificados gratis).
- **Cómo llegan:** la gente llena el formulario con foto, zona marcada en el mapa (OpenStreetMap) y su celular.
  - El aviso se guarda en la hoja **Mascotas** o **Anuncios** con estado `pendiente`.
  - La foto va a la subcarpeta **«Altiplano al Día — Alerta Mascota»** o **«— Anuncios»**, dentro de la carpeta principal de Drive (`CARPETA_RAIZ` en `Code.gs`).
  - La foto queda **privada** hasta que se aprueba.
- **Moderación:** en `/admin` → **Avisos**. «Aprobar y publicar» lo muestra en la web en 1 a 2 minutos y comparte la foto con el enlace. «Rechazar» lo oculta y vuelve la foto a privada. «Marcar resuelto» deja el aviso 15 días como «¡Ya está en casa!».
- **Ciclo de vida y datos personales** (se cumple solo, con una limpieza diaria a las 3 a. m.; también está en el menú **Altiplano → Limpiar datos personales de avisos viejos**):
  1. **Vigente:** aprobado y con menos de 2 meses (mascotas) o 1 mes (anuncios). Se ve con su número y el punto exacto en el mapa.
  2. **Archivo:** cuando se marca resuelto o vence el plazo, sigue en la web en la pestaña «Archivo», pero **sin número, sin nombre** y con la ubicación redondeada a unos 1 km.
  3. **Datos borrados:** 30 días después de pasar al archivo, la limpieza **borra de la hoja** el número, el nombre y el punto exacto. La publicación (texto, foto, zona, provincia) se conserva.
  - Los rechazados y los pendientes sin revisar de más de 30 días se borran del todo: texto, número y ubicación, y la foto va a la papelera de Drive.
  - En las denuncias de **maltrato**, el número de quien denuncia nunca se publica.
- **Protecciones:** campo trampa contra robots, máximo 3 avisos por número cada 6 horas y 80 por hora en total, y textos que no se ejecutan como fórmula.
- **Maltrato:** el formulario pide no poner nombres de personas ni fotos con sangre. En la web esos avisos salen sin el botón de WhatsApp del denunciante.

### Conexión con la cuenta de Altiplano al Día

La hoja y la carpeta son las de la cuenta del medio:

- Hoja: `https://docs.google.com/spreadsheets/d/1zFC4EkSIOM4ZOoofbV7Am1xXoORIPf2nO-EWJeZU_Ww`
- Carpeta de Drive: `https://drive.google.com/drive/folders/1CZcFqPBYGKmyn9cXuuyID-KU6W7RXNfo` (ya puesta en `CARPETA_RAIZ`)

Con esa cuenta abierta en el navegador, se siguen los pasos de **Instalación** de arriba sobre **esa hoja**: pegar `Code.gs`, Inicializar e Implementar como aplicación web. Después:

1. En GitHub, se pone la URL `/exec` en la variable `SHEETS_API`.
2. En el maquetador, va en `sheets_api` y la clave en `.env`.

Si el script ya estaba publicado, basta con **Gestionar implementaciones → Nueva versión** y correr **Inicializar** otra vez: crea las hojas y carpetas nuevas sin tocar lo que ya existe.

## Orden de Drive y denuncias ciudadanas

**Árbol de carpetas.** El servidor lo crea solo dentro de la carpeta principal, ordenado por tipo y por mes. Cada archivo se llama igual que el id de su fila en la hoja.

```
Altiplano al Día/
  Notas/2026-11/                         fotos de las notas (maquetador y /admin)
  Alerta Mascota/{Perdidos, Encontrados, Maltrato, Adopción y ayuda}/2026-11/M….jpg
  Anuncios/{Ofertas de empleo, Busco empleo, Vendo, Compro, Alquilo, Servicios, Eventos, Otros}/2026-11/A….jpg
  Denuncias ciudadanas/{Servicios públicos, Seguridad, Corrupción, Salud, Educación, Medio ambiente, Transporte, Otros}/2026-11/D….jpg
```

**Denuncias.**
- **Hoja `Denuncias`:** recibe lo que llega desde `/denuncia` cuando la web está conectada; sin conexión, ese formulario sigue abriendo WhatsApp.
- **Nunca se publican.** En el panel (/admin → Avisos → Denuncias ciudadanas), «En verificación» corresponde al estado `aprobado`, y «resuelto» quiere decir nota hecha o caso cerrado.
- **Anonimato:** se pueden enviar sin celular.

**Plantilla.** `Estructura_Sheets_Altiplano.xlsx` trae todas las pestañas con sus encabezados exactos, junto con el diccionario de columnas, el flujo web → Sheets → Drive y el árbol de Drive.

## Credenciales de prensa

- **Emitir:** en `/admin`, pestaña **Credenciales** (solo el admin), elige «+ Nueva credencial».
  - Se llena nombre, cargo, DNI, vencimiento y foto. La foto se recorta sola al formato 3:4.
  - El servidor asigna un código `AAD-XXXXXX`. Las filas quedan en la hoja «Credenciales» y las fotos en Drive, en «Credenciales», en privado.
- **Imprimir:** con «Ver e imprimir» se imprimen frente y dorso a tamaño CR80 (54 × 85,6 mm), al 100 %. También se pueden bajar en SVG para retocarlos en Inkscape.
- **Validar:** el QR abre `altiplanoaldia.pe/verificar/<código>`. Esa página muestra si la credencial está vigente, vencida, revocada o no registrada, con foto y nombre. El DNI aparece tapado (`****1234`).
- **Revocar:** en «Editar», marca «Revocar» y escribe el motivo. La validación lo muestra al instante.
- **Diseño:** la plantilla está en `public/brand/credencial/frente.svg` y `dorso.svg`. Se regenera con `node scripts/credencial/construir.mjs --pdf`. Si se edita en Inkscape, hay que conservar los textos `{{…}}` y los grupos `qr-frente` y `qr-dorso`.
- **Vista previa con foto real**, sin emitir: `node scripts/credencial/vista-previa.mjs <foto> "<Nombre>" "<Cargo>" [DNI] [vence] [carpeta]`.
