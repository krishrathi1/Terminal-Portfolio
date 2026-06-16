const DEFAULT_USERNAME = 'krishrathi';

const query = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
      userCalendar {
        streak
        totalActiveDays
        submissionCalendar
      }
    }
  }
`;

function getCount(rows, difficulty) {
  return rows.find((row) => row.difficulty === difficulty)?.count || 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const requestedUsername = String(req.query?.username || DEFAULT_USERNAME);
  const username = /^[a-zA-Z0-9_-]{1,32}$/.test(requestedUsername)
    ? requestedUsername
    : DEFAULT_USERNAME;

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: `https://leetcode.com/u/${username}/`,
        'User-Agent': 'Terminal-Portfolio'
      },
      body: JSON.stringify({ query, variables: { username } })
    });

    if (!response.ok) {
      throw new Error(`LeetCode responded with ${response.status}`);
    }

    const payload = await response.json();
    const user = payload.data?.matchedUser;
    const solvedRows = user?.submitStatsGlobal?.acSubmissionNum || [];
    const calendar = user?.userCalendar || {};
    const submissionCalendar = calendar.submissionCalendar
      ? JSON.parse(calendar.submissionCalendar)
      : {};

    if (!user) {
      res.status(404).json({ error: 'LeetCode user not found' });
      return;
    }

    res.status(200).json({
      source: 'leetcode-graphql',
      username: user.username,
      updatedAt: new Date().toISOString(),
      totalSolved: getCount(solvedRows, 'All'),
      easySolved: getCount(solvedRows, 'Easy'),
      mediumSolved: getCount(solvedRows, 'Medium'),
      hardSolved: getCount(solvedRows, 'Hard'),
      activeDays: calendar.totalActiveDays || Object.keys(submissionCalendar).length,
      streak: calendar.streak || 0,
      submissionCalendar
    });
  } catch (error) {
    res.status(502).json({
      error: 'Unable to fetch LeetCode stats',
      detail: error.message
    });
  }
}
