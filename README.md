# Afterimage

A browser-based visual studio for live footage, poetry and generative annotations.

Import a video or photograph, or use your camera. Switch between the original image and particles; add moving frames, connecting lines, original English poetry, imagined musical scores or code. Save a PNG or record a silent canvas video.

The public edition processes media locally. No media is uploaded and no API key is required. Poetry responds to brightness and motion; it is not object recognition. AI scene understanding requires the separately run local server edition and is disabled on this static site.

## Technology and design

HTML, CSS, JavaScript and Canvas 2D. GSAP provides the finite entrance animation. The title reveal adapts React Bits DecryptedText to vanilla JavaScript. Reduced-motion preferences and keyboard navigation are supported. Design was refined with taste-skill guidance while preserving the creative studio workflow.

Serve this folder with a static server, or publish the main branch root using GitHub Pages. All runtime assets are included; no build step is needed. See THIRD-PARTY-NOTICES.txt and vendor/react-bits-LICENSE.txt for third-party credits and licensing.
