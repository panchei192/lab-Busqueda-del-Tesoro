# 🏆 Tesoro del Sacré Coeur · Búsqueda del tesoro en Realidad Aumentada

Juego web de realidad aumentada basada en marcadores, hecho con **AR.js 3.4.8** y **A-Frame 1.8.0**.
Funciona en el navegador del celular (Chrome / Safari), sin instalar nada.

## Cómo se juega

1. El jugador abre la URL, toca **¡Empezar!** y permite la cámara.
2. Apunta al **marcador 1 (Hiro)** → aparece el pergamino de la leyenda y la primera pista.
3. La pista lo lleva al **marcador 2 (llave)** → brújula + llave flotante y la segunda pista.
4. La segunda pista lo lleva al **marcador 3 (corazón con cruz)** → el **cofre se abre**, suena una fanfarria, cae confeti y aparece la pantalla final con el tiempo total.

Los marcadores se desbloquean **en orden**: si alguien apunta al marcador 3 sin haber pasado por el 1 y el 2, ve un candado 🔒 en lugar del cofre.
El progreso y el cronómetro se guardan en el navegador (si recargan la página no pierden nada).

## ✅ Antes de publicar (lo único que hay que hacer a mano)

1. **Imprimí `marcadores.pdf`** (3 páginas A4, un marcador por página; mejor en papel mate).
   Las imágenes sueltas están en `markers/`.
2. **Pegá los marcadores** en el Sacré Coeur, planos, a la altura de los ojos y con buena luz.
3. **Adaptá las pistas** a los lugares reales donde los pegaste: están al principio de `js/game.js`, en `CONFIG.clues`
   (campos `title`, `story` y `next`). Cada pista ya nombra el dibujo del siguiente marcador (llave / corazón),
   así que aunque la adivinanza sea vaga, el jugador sabe qué buscar.
4. (Opcional) Poné el nombre de tu equipo en `CONFIG.team`: aparece en la pantalla final.

## 🚀 Publicar en GitHub Pages (≈ 3 minutos)

1. Creá un repositorio **público** en GitHub (por ejemplo `tesoro-sacre-coeur`).
2. Subí **todo el contenido de esta carpeta** (botón *Add file → Upload files*; arrastrá las carpetas `css`, `js`, `lib`, `data`, `patterns`, `markers` y los archivos sueltos). `index.html` tiene que quedar en la raíz del repo.
3. En el repo: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. Esperá 1–2 minutos. La URL queda así: `https://TU-USUARIO.github.io/tesoro-sacre-coeur/`
5. Abrila **desde el celular** y comprobá que pide permiso de cámara. Esa URL es el entregable.

> La cámara solo funciona con **HTTPS** (GitHub Pages ya lo da) o en `localhost`.
> En Azure Static Web Apps también sirve: es un sitio estático, no necesita build.

## 🧪 Probar antes de entregar

- **Prueba rápida sin recorrer el edificio:** abrí la URL en el celular y apuntá a los marcadores impresos (o a las imágenes de `markers/` mostradas en la pantalla de una notebook, con el brillo alto).
- **Modo depuración:** agregá `?debug=1` a la URL y se muestra abajo qué marcador ve la cámara y cuáles están desbloqueados.
  Ejemplo: `https://TU-USUARIO.github.io/tesoro-sacre-coeur/?debug=1`
- **Borrar el progreso:** `?reset=1` (o el botón *Empezar de cero* / *Jugar de nuevo*). **Hacelo antes de pasarle el link a los testers**, así ven el juego desde cero.
- **Local en la notebook:** `python3 -m http.server 8000` dentro de la carpeta y abrir `http://localhost:8000`.
  (Desde el celular por IP local no anda la cámara, porque no es HTTPS: usá GitHub Pages.)

## 🛠️ Si algo no funciona

| Síntoma | Qué hacer |
|---|---|
| No pide cámara / pantalla negra | Abrir el link en **Chrome o Safari** (no dentro de WhatsApp o Instagram) y aceptar el permiso. |
| El marcador no se detecta | Más luz, evitar reflejos (papel mate), distancia de 30 cm a 1 m, sin tapar el borde negro. |
| Aparece un candado 🔒 | Ese marcador todavía no corresponde: hay que seguir las pistas en orden. |
| Cambié algo y no se ve | Recargar sin caché (o agregar `?v=2` a la URL). |
| Quiero que el orden sea libre | En `js/game.js`: `enforceOrder: false`. |

## 📁 Estructura

```
index.html            escena AR (a-scene + 3 a-marker con sus modelos 3D) e interfaz
css/style.css         estilos de la interfaz
js/game.js            lógica: progreso, pistas, cronómetro, sonido, confeti  ← editar CONFIG acá
lib/                  A-Frame 1.8.0 y AR.js 3.4.8 (copias locales, no dependen de CDN)
patterns/             patt.hiro, patt.llave, patt.corazon (patrones de los marcadores)
data/camera_para.dat  parámetros de cámara de AR.js
markers/              imágenes de los 3 marcadores
marcadores.pdf        los 3 marcadores listos para imprimir
```

## Detalles técnicos

- Marcadores tipo `pattern` (`<a-marker type="pattern" url="patterns/…">`) con eventos `markerFound` / `markerLost`.
- Modelos 3D construidos con primitivas de A-Frame (`a-box`, `a-cylinder`, `a-torus`, `a-cone`, `a-sphere`, `a-octahedron`) y animaciones declarativas; sin archivos externos que puedan fallar.
- Marcador 1: el **Hiro** oficial de AR.js. Marcadores 2 y 3: diseñados para este juego (llave y corazón con cruz) y verificados para que no se confundan entre sí ni al girarlos.
- Sonidos generados con WebAudio (no hay archivos de audio). Vibración en Android.
