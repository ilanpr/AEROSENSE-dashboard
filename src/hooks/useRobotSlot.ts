import { useEffect, useState } from "react";

const eventName = "aerosense:robot-slot";
export const ROBOT_SLOTS = ["robot-1", "robot-2", "robot-3"];
export function robotSlot(userId?: string) {
  try {
    const slot = localStorage.getItem("aerosense.robot-slot." + userId);
    return ROBOT_SLOTS.includes(slot || "") ? slot! : ROBOT_SLOTS[0];
  } catch {
    return ROBOT_SLOTS[0];
  }
}
export function useRobotSlot(userId?: string) {
  const [slot, setSlot] = useState(() => robotSlot(userId));
  useEffect(() => {
    const sync = () => setSlot(robotSlot(userId));
    sync();
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId]);
  return [
    slot,
    (value: string) => {
      if (!ROBOT_SLOTS.includes(value)) return;
      try {
        localStorage.setItem("aerosense.robot-slot." + userId, value);
      } catch {
        /* session only */
      }
      setSlot(value);
      window.dispatchEvent(new Event(eventName));
    },
  ] as const;
}
