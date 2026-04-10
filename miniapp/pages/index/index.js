var BASE_URL = 'https://werewolfjudge.eu.org/'

Page({
  data: {
    url: BASE_URL
  },

  onLoad(options) {
    // 优先级: 转发 query > storage 恢复 > 默认首页
    if (options.url) {
      this.setData({ url: decodeURIComponent(options.url) })
    } else {
      try {
        var lastUrl = wx.getStorageSync('lastUrl')
        if (lastUrl) {
          this.setData({ url: lastUrl })
        }
      } catch (e) {
        console.warn('read lastUrl failed:', e)
      }
    }
  },

  onMessage(e) {
    // postMessage 在后退/销毁/分享/复制链接时批量送达
    var data = e.detail.data
    if (!data || !data.length) return
    // 取最后一条消息的 url
    var last = data[data.length - 1]
    if (last && last.url) {
      try {
        wx.setStorageSync('lastUrl', last.url)
      } catch (err) {
        console.warn('save lastUrl failed:', err)
      }
    }
  },

  onError(e) {
    console.error('web-view load error:', e.detail)
  },

  onShareAppMessage(options) {
    var webViewUrl = options.webViewUrl || ''
    var match = webViewUrl.match(/\/room\/([A-Za-z0-9]+)/)
    if (match) {
      return {
        title: '来一起玩狼人杀！房间 ' + match[1],
        path: '/pages/index/index?url=' + encodeURIComponent(webViewUrl)
      }
    }
    return {
      title: '狼人杀自助电子法官',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '狼人杀自助电子法官',
      query: ''
    }
  }
})
