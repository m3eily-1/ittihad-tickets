# Fan chants

Put the club's official fan-chant recording here (e.g. `ittihad-chants.mp3`, ideally a seamless loop,
128–192 kbps MP3 or AAC), then set `src: '/audio/ittihad-chants.mp3'` in `src/dirs/tunnel/chants.js`.
Until then the "Chants" toggle plays a synthesised stadium atmosphere (roar, claps, drums — no voices);
setting `src` swaps it for the recording.

To audition a file before wiring it in: `/tunnel.html?chants=/audio/your-file.mp3`.

Behaviour: muffled through the tunnel and rooms, opens up as you walk out of the mouth, full in the
bowl, fades out once you scroll past the stadium. Starts only after a click (browser autoplay rules);
the visitor's on/off choice is remembered on their device.
