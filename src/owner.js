// The owner of smudgeGAMES gets a special badge wherever their name shows up.
export const OWNER = 'smudgemuffin'

export function isOwner(name) {
  return (name || '').toLowerCase() === OWNER
}
