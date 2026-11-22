# Slipstream

A playable Three.js driving prototype with four selectable courses. The scene, vehicle and instruments are generated locally. Gameplay requires a WebGL 2 browser.

## Run locally

Use Node.js 22.12 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Use `pnpm build` for a production build and `pnpm preview` to run it locally.

Run the physics regression tests with `pnpm test`.

## Courses

Open **Courses** to switch maps.

- **Redrock Basin** is the original desert free drive.
- **Meridian Strip** accepts whole-metre distances from 50 to 2,000 m. Choose prepared asphalt, wet asphalt, loose gravel or packed ice. Select **Arm launch** to start the three lights. Holding the throttle stages the car for an automatic launch at green. Pressing the throttle after green records your reaction time. Total time runs from green to the finish line. The timing slip also shows peak acceleration, speed and driven-wheel slip.
- **Foundry City** is a timed street lap. Follow the mint arrows and pass each checkpoint in sequence before crossing the start/finish line.
- **Tesla Skyway** puts you in the flying Roadster for eight aerial gates. Use E and Q to match the next gate’s altitude. Leaving the course restores your previous vehicle.

## Drive

| Input          | Action                                     |
| -------------- | ------------------------------------------ |
| W or ↑         | Accelerate                                 |
| S or ↓         | Brake, then reverse while held             |
| A / D or ← / → | Steer                                      |
| Space          | Handbrake                                  |
| R              | Return to the starting position            |
| C              | Cycle chase, wide chase and bonnet cameras |
| Scroll wheel   | Select the next or previous vehicle        |
| E / Q          | Raise or lower the flying Roadster         |

The five vehicles are the rally coupe, light-blue sports coupe, yellow school bus, white semi tractor and white Tesla Roadster 2 Rocket Edition. Switching keeps your position, heading and momentum while the outgoing body breaks apart and the new one assembles. The browser remembers the last selection for this site.

The control strip and vehicle arrows also support pointer and touch input. The HUD uses the selected vehicle’s colour and shows its plate, speed, gear, progressive pedal inputs, steering and measured FPS. The north-up minimap follows your position and heading on the selected course.

## Handling

Each vehicle defines its own launch acceleration, braking, coasting resistance, cornering limit, pedal response and steering response. The rally coupe turns in quickly, the sports coupe has more tarmac grip, the school bus has a gradual launch and a wide turn, and the semi is tuned as a tractor without a trailer. The electric Roadster has stronger lift-off deceleration on the ground. In flight, its nose can turn independently of its momentum. Holding W applies rear thrust, while E and Q change the target hover height.

These are game calibrations. The sports coupe draws on Porsche’s mid-engine 718, the rally coupe on Subaru’s AWD rally cars, and the heavy vehicles on school-bus performance requirements and Freightliner’s description of unloaded tractor braking. The Roadster’s white paint and cold-gas jets reference Tesla’s Rocket demonstration. [Porsche 718](https://newsroom.porsche.com/en/products/porsche-cayman-model-series-718-sport-coupe-12475.html) · [Subaru rally cars](https://www.subaru.com/Motorsports/subaru-motorsports-usa/usa-rally-car-lineup.html) · [Florida school bus specifications](https://www.fldoe.org/core/fileparse.php/7585/urlt/0085480-floridaschoolbusspecifications.pdf) · [Freightliner Cascadia driver’s manual](https://dtnacontent-dtna.prd.freightliner.com/content/dam/enterprise/documents/Cascadia%20Drivers%20Manual_.pdf) · [Tesla Roadster](https://www.tesla.com/roadster?redirect=no)

## Structure

- `src/main.js` owns startup, the animation loop, interpolation, resize and context recovery.
- `src/systems/` contains the renderer, camera rig, keyboard and pointer input, and HUD.
- `src/vehicle/physics.js` integrates a planar bicycle model at 120 Hz with lateral grip, rolling resistance, aerodynamic drag, and collision response. Each vehicle uses a line of overlapping collision discs sized to its body. The Roadster uses a damped lift controller and rear thrust in flight. Its wheel rotation follows ground contact. World-space gas particles trace the lift and propulsion jets.
- `src/vehicle/catalog.js` defines vehicle dimensions, plates and colours. `model.js` and `variants.js` build their meshes. `fleet.js` manages selection, while `assembly.js` handles the shared surface and particle transition.
- `src/world/` builds the closed road, scenery, collision proxies and sky. Static scenery is batched by material and region.

One world unit represents one metre. Y points up and the car spawns facing negative Z. A bounded frame delta prevents background-tab delays from accumulating physics steps.
