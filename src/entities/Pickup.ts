import { requirePickup, type PickupKind } from "../data/pickups";
import { Entity } from "./Entity";

/**
 * Lightweight world pickup spawned from enemy deaths.
 */
export class Pickup extends Entity {
  poolIndex = 0;

  pickupKind: PickupKind = "floor_chicken";

  radiusPx = 0;

  fillHex = "#ffffff";

  outlineHex = "#ffffff";

  initializePickup(kind: PickupKind, worldX: number, worldY: number): void {
    const data = requirePickup(kind);
    this.pickupKind = kind;
    this.x = worldX;
    this.y = worldY;
    this.radiusPx = data.radiusPx;
    this.fillHex = data.fillHex;
    this.outlineHex = data.outlineHex;
    this.hp = 1;
    this.maxHp = 1;
    this.active = true;
  }

  resetForPool(): void {
    this.pickupKind = "floor_chicken";
    this.radiusPx = 0;
    this.fillHex = "#ffffff";
    this.outlineHex = "#ffffff";
    this.hp = 0;
    this.maxHp = 0;
  }
}
