# Performance results

Not measured on real hardware. This container has only a software GPU (SwiftShader), whose timings do not predict a phone or a laptop GPU (B-06).

What is known from the code, not from measurement: Sketch Cards paints a card and its words once per line on the CPU (a canvas of at most 1,100 px on the long side, plus one pixel pass for the print process); every other frame draws only cached textures.
