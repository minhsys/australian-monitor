import Parser from 'rss-parser'

const parser = new Parser({ timeout: 8_000, headers: { 'User-Agent': 'AustraliaMonitor/1.0' } })

const AU_FEEDS = [
  // Government & think tanks
  { url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml',              source: 'RBA',              cat: 'economy'  },
  { url: 'https://www.aspistrategist.org.au/feed/',                            source: 'ASPI Strategist',  cat: 'defence'  },
  { url: 'https://www.internationalaffairs.org.au/feed/',                      source: 'AIIA',             cat: 'defence'  },
  // National broadcasters & mastheads
  { url: 'https://www.abc.net.au/news/feed/51120/rss.xml',                    source: 'ABC Top Stories',  cat: 'general'  },
  { url: 'https://www.abc.net.au/news/feed/1948/rss.xml',                     source: 'ABC Just In',      cat: 'general'  },
  { url: 'https://www.theguardian.com/australia-news/rss',                    source: 'Guardian AU',      cat: 'general'  },
  { url: 'https://www.smh.com.au/rss/feed.xml',                               source: 'SMH',              cat: 'general'  },
  { url: 'https://www.theage.com.au/rss/feed.xml',                            source: 'The Age',          cat: 'general'  },
  { url: 'https://thewest.com.au/rss',                                         source: 'The West AU',      cat: 'general'  },
  { url: 'https://feeds.bbci.co.uk/news/world/australia/rss.xml',             source: 'BBC Australia',    cat: 'general'  },
  // Pacific & international
  { url: 'https://www.rnz.co.nz/rss/pacific.xml',                             source: 'RNZ Pacific',      cat: 'pacific'  },
  { url: 'https://www.rnz.co.nz/rss/world.xml',                               source: 'RNZ World',        cat: 'general'  },
  { url: 'https://www.theguardian.com/world/asia-pacific/rss',                source: 'Guardian Pacific',  cat: 'pacific'  },
  // Analysis & commentary
  { url: 'https://theconversation.com/au/articles.atom',                       source: 'The Conversation', cat: 'general'  },
  // Cyber & tech
  { url: 'https://www.bleepingcomputer.com/feed/',                             source: 'BleepingComputer', cat: 'cyber'    },
  { url: 'https://www.darkreading.com/rss.xml',                               source: 'Dark Reading',      cat: 'cyber'    },
]

const DEFENCE_RE   = /defence|aukus|military|army|navy|raaf|adf|submarine|soldier|weapon/i
const SECURITY_RE  = /asio|afp|spy|espionage|intelligence|terror|counterterror/i
const ECONOMY_RE   = /asx|rba|inflation|gdp|interest rate|economy|budget|trade|export|recession|iron ore|tariff/i
const CYBER_RE     = /cyber|hack|ransomware|breach|malware|phish|data leak|vulnerability/i
const EMERGENCY_RE = /fire|flood|cyclone|earthquake|storm|warning|evacuation|disaster/i
const PACIFIC_RE   = /pacific|papua|png|fiji|solomon|vanuatu|tonga|samoa|kiribati|nauru/i
const POLITICS_RE  = /parliament|senate|minister|cabinet|election|labor|liberal|prime minister|albanese|dutton/i

function categorise(title, feedCat) {
  if (DEFENCE_RE.test(title))   return 'defence'
  if (SECURITY_RE.test(title))  return 'security'
  if (CYBER_RE.test(title))     return 'cyber'
  if (EMERGENCY_RE.test(title)) return 'emergency'
  if (ECONOMY_RE.test(title))   return 'economy'
  if (PACIFIC_RE.test(title))   return 'pacific'
  if (POLITICS_RE.test(title))  return 'politics'
  return feedCat
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function hashId(str) {
  let h = 0
  for (const ch of str) h = Math.imul(31, h) + ch.charCodeAt(0) | 0
  return Math.abs(h)
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000  // drop anything older than 7 days

async function fetchFeed(feed) {
  const result = await parser.parseURL(feed.url)
  return (result.items || []).slice(0, 15).map(item => {
    const ts = new Date(item.pubDate || item.isoDate || 0).getTime()
    return {
      id:        hashId(item.link || item.title || String(Math.random())),
      cat:       categorise(item.title || '', feed.cat),
      source:    feed.source,
      time:      relativeTime(item.pubDate || item.isoDate || new Date().toISOString()),
      timestamp: ts,
      text:      (item.title || '').trim(),
      url:       item.link || '',
    }
  })
}

export async function fetchRealNews() {
  const results = await Promise.allSettled(AU_FEEDS.map(fetchFeed))
  const items   = []
  const seen    = new Set()
  const cutoff  = Date.now() - MAX_AGE_MS

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[NEWS] ${AU_FEEDS[i].source} failed:`, r.reason.message)
      return
    }
    r.value.forEach(item => {
      if (item.text && !seen.has(item.id) && item.timestamp > cutoff) {
        seen.add(item.id)
        items.push(item)
      }
    })
  })

  items.sort((a, b) => b.timestamp - a.timestamp)

  const ok = results.filter(r => r.status === 'fulfilled').length
  console.log(`[NEWS] ${items.length} items (≤7d) from ${ok}/${AU_FEEDS.length} feeds`)
  return items.slice(0, 200)
}
