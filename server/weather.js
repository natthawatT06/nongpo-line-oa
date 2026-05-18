export async function getWeatherSummary(latitude, longitude) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('daily', 'precipitation_sum,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('timezone', 'Asia/Bangkok')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo failed with ${response.status}`)
  }

  const data = await response.json()
  const daily = data.daily
  const rainTotal = sum(daily.precipitation_sum)
  const maxTemp = Math.max(...daily.temperature_2m_max)
  const minTemp = Math.min(...daily.temperature_2m_min)
  const dryDays = daily.precipitation_sum.filter((rain) => rain < 1).length
  const wetDays = daily.precipitation_sum.filter((rain) => rain >= 5).length
  const bestWindow = findPlantingWindow(daily)

  return {
    rainTotal,
    maxTemp,
    minTemp,
    dryDays,
    wetDays,
    bestWindow,
  }
}

function findPlantingWindow(daily) {
  let bestStart = 0
  let bestScore = -Infinity

  for (let i = 0; i <= daily.time.length - 3; i += 1) {
    const rains = daily.precipitation_sum.slice(i, i + 3)
    const temps = daily.temperature_2m_max.slice(i, i + 3)
    const rainScore = rains.reduce((score, rain) => score + scoreRain(rain), 0)
    const tempScore = temps.reduce((score, temp) => score + (temp <= 35 ? 2 : -1), 0)
    const score = rainScore + tempScore

    if (score > bestScore) {
      bestScore = score
      bestStart = i
    }
  }

  return {
    start: formatThaiDate(daily.time[bestStart]),
    end: formatThaiDate(daily.time[bestStart + 2]),
  }
}

function scoreRain(rain) {
  if (rain >= 2 && rain <= 12) return 4
  if (rain > 12 && rain <= 30) return 1
  if (rain < 2) return 0
  return -2
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0)
}

function formatThaiDate(value) {
  const date = new Date(`${value}T00:00:00+07:00`)
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}
