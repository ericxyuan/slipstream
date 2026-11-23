# SlipStream

A browser driving game built with Three.js, Vite and a shared 120 Hz vehicle simulation. Four environments support solo driving and party races. Cloudflare serves the compiled game and coordinates each party in a separate Durable Object.

## Run

Use Node 24 and pnpm 11. Install with `pnpm install --frozen-lockfile`.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Solo development with hot reload |
| `pnpm dev:party` | Build and run the frontend and multiplayer Worker together locally |
| `pnpm test` | Run physics, race, configuration and vehicle regression tests |
| `pnpm build` | Produce the static game in `dist/` |
| `pnpm smoke:party http://localhost:8787` | Exercise two independent clients against the running Worker |
| `pnpm deploy` | Test, build and release with the signed-in Cloudflare account |

Open the URL printed by the chosen development server. WebGL 2 is required. Sound starts following a keyboard or pointer gesture.

## Driving and racing

Use WASD or the arrow keys to drive, Space for the handbrake and Shift for boost. Drag with the left mouse button to look around. C recenters an adjusted camera before cycling views. E and Q control Roadster lift. J preloads and releases the U9 suspension once per press. R resets solo driving. Scroll advances through the three vehicles selected in Active Rotation.

X opens the menu. Maps enters free drive. Race Configuration chooses the map, route, direction, start and finish, gate count, surface sections, lap count, countdown, collisions, DNF timeout and competition rules. Named presets stay in the browser. The course preview uses the same path as the gate detector. Drag races accept a positive whole distance in metres on every map. Ground strips reuse nearby road sections as you drive. Circuit starts wrap around the closed route. G opens race configuration, P opens party management, and V toggles readiness in a race lobby. F starts a solo race or a ready party as host, Esc cancels its countdown, and early propulsion input records a false start. Open menus pause solo driving. Party clocks and other drivers continue.

Create or join a four-letter code under Multiplayer. The host sets the event. Drivers choose their vehicle and mark themselves ready. The host starts the countdown after everyone is ready. Player input travels over WebSockets. The server runs movement, checks each directed gate and resolves vehicle and prop impulses. Results include valid finishes, false starts and DNF. A disconnected browser may reconnect with its session token during the 30-second grace period. Empty rooms expire. Up to twelve drivers are supported per party.

## Vehicles and simulation

| Vehicle | Reference or game target | Top speed |
| --- | --- | --- |
| Rally coupe | 3.1 s to 100 km/h, 1,550 kg | 265 km/h |
| Sports coupe | 2.1 s to 100 km/h, 1,350 kg | 345 km/h |
| School bus | 4.2 s to 100 km/h, 9,000 kg | 205 km/h |
| Semi tractor | 4.0 s to 100 km/h, 15,000 kg | 230 km/h |
| Tesla Roadster Rocket | Specification reference of under 0.59 s to **60 mph**. Sustained flight and estimated mass are game parameters. | 375 km/h ground tune |
| Yangwang U9 Xtreme | Four motors, 1,200 V, approximately 2,220 kW / 3,019 PS. Dawn Moment black and gold colourway. | 503.17 km/h recorded |
| 2018–2020 BMW i8 Coupé | Plug-in hybrid AWD, 275 kW / 374 PS, 4.4 s to 100 km/h | 250 km/h |

The first four figures are fictional game targets on a prepared straight. The garage's U9 launch and Roadster mass are estimates. The U9's game jump uses the standard U9's short stationary suspension jump as a reference. Its separate moving demonstration concerns horizontal travel. The simulator does not claim an Xtreme jump measurement.

Cold-gas flight uses named baseline capabilities with a 1.8 multiplier. Tyre support decides which propulsion system can apply longitudinal force. The HUD combines lateral and vertical coordinate acceleration into one magnitude, shown in m/s² and g. The brake and regeneration levels sit behind the shift lights. Nominal 1.5 m/s² lift-off regeneration fills 37.5% of the 4 m/s² gauge. Recovered energy, battery reserve, speed and surface grip affect the result.

Vehicle references include [BYD's speed record announcement](https://www.byd.com/mea/news-list/yangwang-u9-xtrem-tops-500kmh), [BMW's facelift specifications](https://www.press.bmwgroup.com/global/article/detail/T0286588EN/specifications-of-the-bmw-i8-coupe-valid-from-09-2018) and [Tesla's Roadster page](https://www.tesla.com/roadster).

## Source and deployment

- `src/world` defines metre-scaled maps, roads, surfaces, procedural scenery and collision shapes.
- `src/vehicle` contains models, data, flight, powertrains, geometry transitions and the vehicle simulation.
- `src/systems` handles racing, audio, input, camera, instruments, remote drivers and menus.
- `worker/index.js` validates room access, runs authoritative simulation and persists party state.
- `scripts/party-smoke.mjs` checks host permissions, a shared grid, movement, reconnection, a timed finish, DNF and identical results on both clients.

GitHub Actions checks pull requests, packages a downloadable preview and exercises real WebSocket connections against Wrangler. Pushes to main additionally deploy and run a production smoke test. Set repository Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to enable unattended deployment. Use a deployment token restricted to the target account and Workers deployment permissions. Keep Wrangler login files and development secrets outside source control.

## Implementation limits

The vehicles and buildings are hand-built procedural models. Handling is tuned for play on flat road surfaces. The simulation uses compound horizontal vehicle footprints and suspension travel, and the audio uses procedural synthesis. The route editor selects sections and checkpoints along predefined paths. These approximations allow the browser and room coordinator to run the same simulation. Two-client tests cover real races. Twelve-player load, mobile GPU performance and long-duration network conditions require separate testing.
