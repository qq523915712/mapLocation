import jsonp from 'jsonp'
import { sleep } from './index'
import { getGoogleCoords } from '../utils'

function getFromStorage(key) {
  const cache = localStorage.getItem(key)
  if (!cache) {
    return null
  }
  return JSON.parse(cache)
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getCode(platform, locations, onProgress) {
  if(!locations || !locations.length) {
    return []
  }
  const result = []
  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    let code
    if(platform ==='google') {
      code = await getCodeFromGoogle(location)
      if (code.isError && code.status === 'OVER_QUERY_LIMIT') {
        throw new Error('OVER_QUERY_LIMIT')
      }
    } else {
      code = await getCodeFromBaidu(location)
    }
    onProgress(code)
  }
  return result
}

async function getCodeFromBaidu(location){
  const cacheKey = `baidu_${location}`
  const cache = getFromStorage(cacheKey)
  if (cache) {
    return {...cache, coords: cache.coords || 'bd09'}
  }
  // 为了不超qps限制，手动增加间隔
  await sleep(500)
  const url = `https://api.map.baidu.com/geocoder/v2/?address=${encodeURIComponent(location)}&output=json&ak=${window.baiduApiKey}`

  const res = await jsonpPromise(url, {
    param: 'callback',
    prefix: 'showLocation',
  })

  if (res.status !== 0) {
    return {
      location,
      isError: true,
      message: res.msg,
      status: res.status,
    }
  }

  const result = {
    location,
    isError: false,
    code: res.result.location,
    precise: res.result.precise,
    confidence: res.result.confidence,
    level: res.result.level,
    coords: 'bd09',
  }
  saveToStorage(cacheKey, result)
  return result
}

async function getCodeFromGoogle(location){
  const cacheKey = `google_${location}`
  const cache = getFromStorage(cacheKey)
  if (cache) {
    return {...cache, coords: cache.coords || getGoogleCoords(cache.code.lng, cache.code.lat)}
  }
  // 为了不超qps限制，手动增加间隔
  await sleep(500)
  const { results, status } = await googleGeoCodePromise(location);
  if (status === 'ERROR') {
    return {
      location,
      isError: true,
      message: `请求Google服务失败，请使用Baidu或使用代理。`,
      status: '',
    }
  }
  if (status !== 'OK') {
    return {
      location,
      isError: true,
      message: `${status}`,
      status: status,
    }
  }

  const result = {
    location,
    isError: false,
    code: {
      lat: results[0].geometry.location.lat(),
      lng: results[0].geometry.location.lng(),
    },
    precise: results[0].geometry.location_type,
    coords: getGoogleCoords(results[0].geometry.location.lng, results[0].geometry.location.lat)
  }
  saveToStorage(cacheKey, result)
  return result
}

function jsonpPromise(url, opts) {
  return new Promise((resolve, reject) => {
    jsonp(url, opts, (err, data) => {
      if(err) {
        return reject(err)
      }
      return resolve(data)
    })
  })
}

let geocoder = null;
function googleGeoCodePromise(location) {
  if (!geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  return new Promise((resolve) => {
    geocoder.geocode( { 'address': location}, function(results, status) {
      resolve({
        results,
        status,
      })
    });
  })
}
