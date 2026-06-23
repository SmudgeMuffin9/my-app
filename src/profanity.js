// A basic blocklist so usernames stay clean. Not perfect, but catches the
// obvious stuff. Matched as substrings against the lowercased username.
const BAD_WORDS = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'piss', 'crap',
  'cock', 'cunt', 'slut', 'whore', 'damn', 'nigg', 'fag', 'retard', 'rape',
  'porn', 'sex', 'nazi', 'penis', 'vagina', 'boob', 'tit', 'pussy',
]

// returns an error message if the name is bad, or null if it's good
export function checkUsername(name) {
  const n = name.trim()
  if (n.length < 3) return 'Username must be at least 3 characters'
  if (n.length > 12) return 'Username must be 12 characters or less'
  if (!/^[a-zA-Z0-9_]+$/.test(n)) return 'Only letters, numbers, and _ are allowed'
  const lower = n.toLowerCase()
  if (BAD_WORDS.some((w) => lower.includes(w))) {
    return "That username isn't allowed — keep it clean! 😇"
  }
  return null
}
