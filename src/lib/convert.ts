export interface Action { pos: number; at: number }

export function actionsToCsv(actions: Action[]): string {
    return actions.map(({ at, pos }) => `${at},${pos}`).join("\n") + "\n"; // must add trailing LF, this is what Handy FW3 does when calculating hashing. Without trailing, different hash, The Handy will reject.
}