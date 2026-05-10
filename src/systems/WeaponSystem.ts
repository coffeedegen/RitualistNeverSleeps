import type { Player } from "../entities/Player";
import { requireWeapon } from "../data/weapons";
import type { WeaponRuntimeContext } from "../weapons/WeaponBase";
import {
  createWeaponBehaviour,
  type WeaponBehaviour,
} from "../weapons/WeaponBehaviourFactory";

export interface WeaponHudSkill {
  id: string;
  name: string;
  level: number;
  ready: boolean;
  cooldownRemainingMs: number;
}

/**
 * Maintains scripted weapon behaviours aligned with Survivor lanes.
 */
export class WeaponSystem {
  private readonly behaviourByWeaponId = new Map<string, WeaponBehaviour>();

  constructor(private readonly bearer: Player) {
    this.rebuildBehaviourTable();
  }

  /** Clears scripted handlers — required after swaps / evolutions. */
  rebuildBehaviourTable(): void {
    this.behaviourByWeaponId.clear();
    for (const lane of this.bearer.weaponLanes) {
      this.behaviourByWeaponId.set(lane.id, createWeaponBehaviour(lane.id));
    }
  }

  /** Fans out scripted weapon loops for the surviving lanes. */
  tick(runtime: WeaponRuntimeContext): void {
    for (const lane of this.bearer.weaponLanes) {
      let script = this.behaviourByWeaponId.get(lane.id);
      if (script === undefined) {
        this.rebuildBehaviourTable();
        script = this.behaviourByWeaponId.get(lane.id);
      }

      if (script === undefined) {
        continue;
      }

      script.tick(runtime, lane.level);
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const lane of this.bearer.weaponLanes) {
      const script = this.behaviourByWeaponId.get(lane.id);
      if (script?.renderWorld !== undefined) {
        script.renderWorld(ctx);
      }
    }
  }

  /** Increments a weapon lane respecting capstones. */
  elevateWeaponByAuthoringId(id: string): boolean {
    return this.bearer.elevateWeapon(id);
  }

  acquireWeaponLane(id: string): boolean {
    const accepted = this.bearer.tryAddWeapon(id);
    if (accepted) {
      this.rebuildBehaviourTable();
    }
    return accepted;
  }

  evolveWeaponLane(baseWeaponId: string): boolean {
    const evolved = this.bearer.tryEvolveWeapon(baseWeaponId);
    if (evolved) {
      this.rebuildBehaviourTable();
    }
    return evolved;
  }

  getHudSkills(): WeaponHudSkill[] {
    return this.bearer.weaponLanes.map((lane) => {
      const script = this.behaviourByWeaponId.get(lane.id);
      const hud = script?.getHudState?.();
      return {
        id: lane.id,
        name: requireWeapon(lane.id).name,
        level: lane.level,
        ready: hud?.ready ?? true,
        cooldownRemainingMs: hud?.cooldownRemainingMs ?? 0,
      };
    });
  }
}
