var BASE_URL = 'https://werewolfjudge.eu.org/'

Page({
  data: {
    url: BASE_URL
  },

  onLoad(options) {
    var self = this

    // 1) 确定目标页面 URL
    var targetUrl
    if (options.url) {
      targetUrl = decodeURIComponent(options.url)
    } else {
      try {
        var lastUrl = wx.getStorageSync('lastUrl')
        // Only restore non-room URLs — rooms are ephemeral and likely expired
        if (lastUrl && lastUrl.indexOf('/room/') === -1) targetUrl = lastUrl
      } catch (e) {
        console.warn('read lastUrl failed:', e)
      }
    }
    if (!targetUrl) targetUrl = BASE_URL

    // 2) wx.login 获取 code，拼入 URL 让 web 端自动登录
    wx.login({
      success: function (res) {
        if (res.code) {
          var sep = targetUrl.indexOf('?') === -1 ? '?' : '&'
          self.setData({ url: targetUrl + sep + 'wxcode=' + res.code })
        } else {
          console.warn('wx.login failed:', res.errMsg)
          self.setData({ url: targetUrl })
        }
      },
      fail: function () {
        self.setData({ url: targetUrl })
      }
    })
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
