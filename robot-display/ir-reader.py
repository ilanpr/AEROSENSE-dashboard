import json
import sys

import serial
from serial.tools import list_ports

if len(sys.argv) == 1:
    print(json.dumps([{"port": p.device, "name": p.description} for p in list_ports.comports()]))
else:
    with serial.Serial(sys.argv[1], 115200, timeout=1) as port:
        while True:
            line = port.read_until(b"\n", size=1024)
            if line.endswith(b"\n"):
                sys.stdout.buffer.write(line)
                sys.stdout.buffer.flush()
