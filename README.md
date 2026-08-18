# DriveSmooth

A static, browser-based driving smoothness experiment. It uses `DeviceMotionEvent` on supported devices and automatically uses a 60 Hz simulator on localhost.

Serve this directory with any static web server, then open it in a browser. On a device, use Settings to set the phone edge facing forward, calibrate while the phone is still, then start a drive. The smoothing time constant controls road-noise filtering: higher values make the line steadier but react more slowly. Chart ranges, orientation, and smoothing are saved in browser local storage; sessions are held in memory only.
