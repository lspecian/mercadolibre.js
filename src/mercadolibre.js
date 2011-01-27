;(function(cookie) {
window.MercadoLibre = {
  baseURL: "https://api.mercadolibre.com",
  
  authorizationURL: "https://auth-frontend.mercadolibre.com.ar/authorization",
  
  hash: {},
  
  callbacks: {},

  _map: {},

  init: function(options) {
    this.options = options

    //Replace defaults
    if (this.options.sandbox) this.baseURL = this.baseURL.replace(/api\./, "sandbox.")
    this.options.isSessionStorageEnable = options.isSessionStorageEnable ? options.isSessionStorageEnable : true
    
    this._initAuthorization()
  },

  get: function(url, callback) {
    Sroc.get(this._url(url), {}, callback)
  },

  post: function(url, params, callback) {
    Sroc.post(this._url(url), params, callback)
  },

  getToken: function() {
    var token = this._getStoredToken()
    if(token){
        var dExp = new Date( parseInt(this._get('date_to_expire_in_as_ms')) )
        var now = new Date()
        if(dExp < now){
            token = null
        }
    }
    return (token && token.length > 0 ) ? token : null
  },
  
  requireLogin: function(callback) {
    var token = this.getToken()

    if (!token) {
      this.pendingCallback = callback
      this.login()
    }else {
      callback()
    }
  },

  login: function() {
    this._cleanIframe()
    this._popup(this._createAuthorizationURL("popup"))
  },

  bind: function(event, callback) {
    if (typeof(this.callbacks[event]) == "undefined") this.callbacks[event] = []
    this.callbacks[event].push(callback)
  },

  trigger: function(event, args) {
    var callbacks = this.callbacks[event]

    if (typeof(callbacks) == "undefined") return

    for (i = 0; i < callbacks.length; i++) {
      callbacks[i].apply(null, args)
    }
  },

  logout: function() {
    this._set("access_token", "")
    this._set("expires_in", "")
    this._triggerSessionChange()
  },
    
  removeAccessToken:function() {
    this._set("access_token", "")
    this._set("expires_in", "")
    this._triggerSessionChange()
  },
    
  silentAuthorization:function(){
    this._iframe = document.createElement("iframe")
    var url = this._createAuthorizationURL("iframe")
    this._iframe.setAttribute("src", url)
    this._iframe.style.width = "0px"
    this._iframe.style.height = "0px"
    document.body.appendChild(this._iframe)
  },
  
  _createAuthorizationURL:function(state){
    var xd_url = window.location.protocol + "//" + window.location.host + this.options.xd_url
    var interactionModeParams = "&state="+ state +(state == "iframe" ? "&interactive=0" : "&display=popup")
    var url = this.authorizationURL + "?redirect_uri=" + escape(xd_url) + "&response_type=token&client_id=" + this.options.client_id + interactionModeParams
    return url
  },
 
  _initAuthorization: function(){
    //Clean old credentials
    if(!this.getToken()){
        this.silentAuthorization()
    }
  },

  _loginComplete: function() {
    //Clean up our interface
    this._cleanIframe()
    if(this._popupWindow) this._popupWindow.close()   
    //Do user staff
    this._triggerSessionChange()
    if (this.pendingCallback) this.pendingCallback()
  },
  
  _cleanIframe:function(){
    if(this._iframe)
        document.body.removeChild(this._iframe)
    this._iframe = null
  },

  _triggerSessionChange: function() {
    this.trigger("session.change", [this.getToken() ? true : false])
  },

  // Check if we're returning from a redirect
  // after authentication inside an iframe.
  _checkPostAuthorization: function() {
    if (this.hash.state && !this.hash.error){
        var parent = window.opener || window.parent
        parent.MercadoLibre._loginComplete() 
    }
  },

  _url: function(url) {
    url = this.baseURL + url

    var token = this.getToken()

    if (token) {
      var append = url.indexOf("?") > -1 ? "&" : "?"

      url += append + "access_token=" + token
    }

    return url
  },

  _parseHash: function() {
    var hash = window.location.hash.substr(1)

    if (hash.length == 0) return

    var self = this

    var pairs = hash.split("&")

    for (var i = 0; i < pairs.length; i++) {
      var pair = null;

      if (pair = pairs[i].match(/([A-Za-z_\-]+)=(.*)$/)) {
        self.hash[pair[1]] = pair[2]
      }
    }

    if (this.hash.access_token) {
      var parent = window.opener || window.parent
      if(parent){
          parent.MercadoLibre._setToken(this.hash.access_token)
          var expires_in = parseInt(this.hash.expires_in)
          parent.MercadoLibre._set("expires_in", expires_in) 
          parent.MercadoLibre._set("date_to_expire_in_as_ms", new Date().getTime() + expires_in)
           
      }
      window.location.hash = ""
    }
  },
  
  
  _get:function(key){
    var value = null
    if( this._isWebStorageEnabled() ){
        value = window.localStorage[key]
    }else{
        value = this._map[key]
    }
    return value
  },
  
  _set:function(key, value){
    if( this._isWebStorageEnabled()  ){
        window.localStorage[key] = value         
    }else{
        this._map[key] = value
    }
  },
  
  _generateSecret:function(){
        var a = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
             'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
             '1','2','3','4','5','6','7','8','9','0']
        shuffle = function(v){
            for(var j, x, i = v.length; i; j = parseInt(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x);
            return v;
        };
        a = shuffle(a)
        var secret = a.slice(0,8).join("")
        return secret
  },
  
  _encrypt:function(secret, message){
        var crypto = window.DESCipher.des(secret, message, 1/*encrypt=true*/, 0/*vector ? 1 : 0*/, null/*vector*/)
	    crypto = window.DESExtras.stringToHex(crypto)
        return crypto
  },
  
  _decrypt:function(secret, message){
        message  = window.DESExtras.hexToString(message)
        message = window.DESCipher.des(secret, message, 0/*encrypt=false*/, 0/*vector=false*/, null/*vector*/)
        return message
  },
  
  _setToken:function(access_token){
    if( this._isWebStorageEnabled() ){
        //genera la clave de cifrado
        secret = this._generateSecret()
        this._set("secret", secret)
        this._set("access_token_original_length", access_token.length)
        //cifrar el access_token
        cryptedToken = this._encrypt(secret, access_token)
        //guardarlo en la cookie
        options = {"domain": this.options.cookiesDomain ? this.options.cookiesDomain : localhost.hostname}
        cookie("access_token",cryptedToken, options)
    }else{
        //guardar el access_token en el storage que tiene scope de pagina
        this._set(access_token)
    }
  },
  
  _getStoredToken:function(){
    var token = null
    if( this._isWebStorageEnabled() ){
      var secret = this._get('secret')
      var cryptedToken = cookie("access_token")
      if(secret && secret != "" && cryptedToken ){
          token = this._decrypt(secret, cryptedToken) 
          var originalLength = parseInt(this._get("access_token_original_length"))
          token = token.substring(0, originalLength)
      }
    }else{
      token = this._get('access_token')
    }
    return token
  },
  
  _isWebStorageEnabled:function(){
      return this.options.isSessionStorageEnable && this._browserHasLocalStorageSupport()
  },
  
  _browserHasLocalStorageSupport:function() {
        try {
            return !!window.localStorage.getItem
        } catch(e) {
            return false
        }
    },
    
  _popup: function(url) {
    if (!this._popupWindow || this._popupWindow.closed) {
      var width = 830
      var height = 510
      var left = parseInt((screen.availWidth - width) / 2);
      var top = parseInt((screen.availHeight - height) / 2);

      this._popupWindow = window.open(url, "mercadolibre-login",
        "toolbar=no,dependent=yes,status=no,location=yes,menubar=no,resizable=no,scrollbars=no,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + "screenX=" + left + ",screenY=" + top
      )
    }
    else {
      this._popupWindow.focus()
    }
  }
}

MercadoLibre._parseHash()

MercadoLibre._checkPostAuthorization()

})(cookie);
