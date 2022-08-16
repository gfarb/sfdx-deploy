"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");

var _Symbol$toPrimitive = require("@babel/runtime-corejs3/core-js-stable/symbol/to-primitive");

var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");

var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");

var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");

var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");

var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");

var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");

var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");

var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.promise");

require("core-js/modules/es.string.replace");

_Object$defineProperty(exports, "__esModule", {
  value: true
});

exports.default = exports.Connection = void 0;

var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));

var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));

var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));

var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));

var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));

var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/parse-int"));

var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));

var _slice = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/slice"));

var _events = require("events");

var _jsforce = _interopRequireDefault(require("./jsforce"));

var _transport = _interopRequireWildcard(require("./transport"));

var _logger = require("./util/logger");

var _oauth = _interopRequireDefault(require("./oauth2"));

var _cache = _interopRequireDefault(require("./cache"));

var _httpApi = _interopRequireDefault(require("./http-api"));

var _sessionRefreshDelegate = _interopRequireDefault(require("./session-refresh-delegate"));

var _query = _interopRequireDefault(require("./query"));

var _sobject = _interopRequireDefault(require("./sobject"));

var _quickAction = _interopRequireDefault(require("./quick-action"));

var _process = _interopRequireDefault(require("./process"));

var _formatter = require("./util/formatter");

function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }

function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[_Symbol$toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }

function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context6; _forEachInstanceProperty(_context6 = ownKeys(Object(source), true)).call(_context6, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context7; _forEachInstanceProperty(_context7 = ownKeys(Object(source))).call(_context7, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; }

/**
 *
 */
const defaultConnectionConfig = {
  loginUrl: 'https://login.salesforce.com',
  instanceUrl: '',
  version: '50.0',
  logLevel: 'NONE',
  maxRequest: 10
};
/**
 *
 */

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 *
 */


function parseSignedRequest(sr) {
  if (typeof sr === 'string') {
    if (sr[0] === '{') {
      // might be JSON
      return JSON.parse(sr);
    } // might be original base64-encoded signed request


    const msg = sr.split('.').pop(); // retrieve latter part

    if (!msg) {
      throw new Error('Invalid signed request');
    }

    const json = Buffer.from(msg, 'base64').toString('utf-8');
    return JSON.parse(json);
  }

  return sr;
}
/** @private **/


function parseIdUrl(url) {
  var _context;

  const [organizationId, id] = (0, _slice.default)(_context = url.split('/')).call(_context, -2);
  return {
    id,
    organizationId,
    url
  };
}
/**
 * Session Refresh delegate function for OAuth2 authz code flow
 * @private
 */


async function oauthRefreshFn(conn, callback) {
  try {
    if (!conn.refreshToken) {
      throw new Error('No refresh token found in the connection');
    }

    const res = await conn.oauth2.refreshToken(conn.refreshToken);
    const userInfo = parseIdUrl(res.id);

    conn._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      userInfo
    });

    callback(undefined, res.access_token, res);
  } catch (err) {
    if (err instanceof Error) {
      callback(err);
    } else {
      throw err;
    }
  }
}
/**
 * Session Refresh delegate function for username/password login
 * @private
 */


function createUsernamePasswordRefreshFn(username, password) {
  return async (conn, callback) => {
    try {
      await conn.login(username, password);

      if (!conn.accessToken) {
        throw new Error('Access token not found after login');
      }

      callback(null, conn.accessToken);
    } catch (err) {
      if (err instanceof Error) {
        callback(err);
      } else {
        throw err;
      }
    }
  };
}
/**
 * @private
 */


function toSaveResult(err) {
  return {
    success: false,
    errors: [err]
  };
}
/**
 *
 */


function raiseNoModuleError(name) {
  throw new Error(`API module '${name}' is not loaded, load 'jsforce/api/${name}' explicitly`);
}
/*
 * Constant of maximum records num in DML operation (update/delete)
 */


const MAX_DML_COUNT = 200;
/**
 *
 */

class Connection extends _events.EventEmitter {
  // describe: (name: string) => Promise<DescribeSObjectResult>;
  // describeGlobal: () => Promise<DescribeGlobalResult>;
  // API libs are not instantiated here so that core module to remain without dependencies to them
  // It is responsible for developers to import api libs explicitly if they are using 'jsforce/core' instead of 'jsforce'.
  get analytics() {
    return raiseNoModuleError('analytics');
  }

  get apex() {
    return raiseNoModuleError('apex');
  }

  get bulk() {
    return raiseNoModuleError('bulk');
  }

  get bulk2() {
    return raiseNoModuleError('bulk2');
  }

  get chatter() {
    return raiseNoModuleError('chatter');
  }

  get metadata() {
    return raiseNoModuleError('metadata');
  }

  get soap() {
    return raiseNoModuleError('soap');
  }

  get streaming() {
    return raiseNoModuleError('streaming');
  }

  get tooling() {
    return raiseNoModuleError('tooling');
  }
  /**
   *
   */


  constructor(config = {}) {
    super();
    (0, _defineProperty2.default)(this, "version", void 0);
    (0, _defineProperty2.default)(this, "loginUrl", void 0);
    (0, _defineProperty2.default)(this, "instanceUrl", void 0);
    (0, _defineProperty2.default)(this, "accessToken", void 0);
    (0, _defineProperty2.default)(this, "refreshToken", void 0);
    (0, _defineProperty2.default)(this, "userInfo", void 0);
    (0, _defineProperty2.default)(this, "limitInfo", {});
    (0, _defineProperty2.default)(this, "oauth2", void 0);
    (0, _defineProperty2.default)(this, "sobjects", {});
    (0, _defineProperty2.default)(this, "cache", void 0);
    (0, _defineProperty2.default)(this, "_callOptions", void 0);
    (0, _defineProperty2.default)(this, "_maxRequest", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "_logLevel", void 0);
    (0, _defineProperty2.default)(this, "_transport", void 0);
    (0, _defineProperty2.default)(this, "_sessionType", void 0);
    (0, _defineProperty2.default)(this, "_refreshDelegate", void 0);
    (0, _defineProperty2.default)(this, "describe$", void 0);
    (0, _defineProperty2.default)(this, "describe$$", void 0);
    (0, _defineProperty2.default)(this, "describeSObject", void 0);
    (0, _defineProperty2.default)(this, "describeSObject$", void 0);
    (0, _defineProperty2.default)(this, "describeSObject$$", void 0);
    (0, _defineProperty2.default)(this, "describeGlobal$", void 0);
    (0, _defineProperty2.default)(this, "describeGlobal$$", void 0);
    (0, _defineProperty2.default)(this, "insert", this.create);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    (0, _defineProperty2.default)(this, "process", new _process.default(this));
    const {
      loginUrl,
      instanceUrl,
      version,
      oauth2,
      maxRequest,
      logLevel,
      proxyUrl,
      httpProxy
    } = config;
    this.loginUrl = loginUrl || defaultConnectionConfig.loginUrl;
    this.instanceUrl = instanceUrl || defaultConnectionConfig.instanceUrl;
    this.version = version || defaultConnectionConfig.version;
    this.oauth2 = oauth2 instanceof _oauth.default ? oauth2 : new _oauth.default(_objectSpread({
      loginUrl: this.loginUrl,
      proxyUrl,
      httpProxy
    }, oauth2));
    let refreshFn = config.refreshFn;

    if (!refreshFn && this.oauth2.clientId) {
      refreshFn = oauthRefreshFn;
    }

    if (refreshFn) {
      this._refreshDelegate = new _sessionRefreshDelegate.default(this, refreshFn);
    }

    this._maxRequest = maxRequest || defaultConnectionConfig.maxRequest;
    this._logger = logLevel ? Connection._logger.createInstance(logLevel) : Connection._logger;
    this._logLevel = logLevel;
    this._transport = proxyUrl ? new _transport.XdProxyTransport(proxyUrl) : httpProxy ? new _transport.HttpProxyTransport(httpProxy) : new _transport.default();
    this._callOptions = config.callOptions;
    this.cache = new _cache.default();

    const describeCacheKey = type => type ? `describe.${type}` : 'describe';

    const describe = Connection.prototype.describe;
    this.describe = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'NOCACHE'
    });
    this.describe$ = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'HIT'
    });
    this.describe$$ = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'IMMEDIATE'
    });
    this.describeSObject = this.describe;
    this.describeSObject$ = this.describe$;
    this.describeSObject$$ = this.describe$$;
    const describeGlobal = Connection.prototype.describeGlobal;
    this.describeGlobal = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'NOCACHE'
    });
    this.describeGlobal$ = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'HIT'
    });
    this.describeGlobal$$ = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'IMMEDIATE'
    });
    const {
      accessToken,
      refreshToken,
      sessionId,
      serverUrl,
      signedRequest
    } = config;

    this._establish({
      accessToken,
      refreshToken,
      instanceUrl,
      sessionId,
      serverUrl,
      signedRequest
    });

    _jsforce.default.emit('connection:new', this);
  }
  /* @private */


  _establish(options) {
    var _context2;

    const {
      accessToken,
      refreshToken,
      instanceUrl,
      sessionId,
      serverUrl,
      signedRequest,
      userInfo
    } = options;
    this.instanceUrl = serverUrl ? (0, _slice.default)(_context2 = serverUrl.split('/')).call(_context2, 0, 3).join('/') : instanceUrl || this.instanceUrl;
    this.accessToken = sessionId || accessToken || this.accessToken;
    this.refreshToken = refreshToken || this.refreshToken;

    if (this.refreshToken && !this._refreshDelegate) {
      throw new Error('Refresh token is specified without oauth2 client information or refresh function');
    }

    const signedRequestObject = signedRequest && parseSignedRequest(signedRequest);

    if (signedRequestObject) {
      this.accessToken = signedRequestObject.client.oauthToken;

      if (_transport.CanvasTransport.supported) {
        this._transport = new _transport.CanvasTransport(signedRequestObject);
      }
    }

    this.userInfo = userInfo || this.userInfo;
    this._sessionType = sessionId ? 'soap' : 'oauth2';

    this._resetInstance();
  }
  /* @priveate */


  _clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.instanceUrl = defaultConnectionConfig.instanceUrl;
    this.userInfo = null;
    this._sessionType = null;
  }
  /* @priveate */


  _resetInstance() {
    this.limitInfo = {};
    this.sobjects = {}; // TODO impl cache

    this.cache.clear();
    this.cache.get('describeGlobal').removeAllListeners('value');
    this.cache.get('describeGlobal').on('value', ({
      result
    }) => {
      if (result) {
        for (const so of result.sobjects) {
          this.sobject(so.name);
        }
      }
    });
    /*
    if (this.tooling) {
      this.tooling._resetInstance();
    }
    */
  }
  /**
   * Authorize (using oauth2 web server flow)
   */


  async authorize(code, params = {}) {
    const res = await this.oauth2.requestToken(code, params);
    const userInfo = parseIdUrl(res.id);

    this._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      userInfo
    });

    this._logger.debug(`<login> completed. user id = ${userInfo.id}, org id = ${userInfo.organizationId}`);

    return userInfo;
  }
  /**
   *
   */


  async login(username, password) {
    this._refreshDelegate = new _sessionRefreshDelegate.default(this, createUsernamePasswordRefreshFn(username, password));

    if (this.oauth2 && this.oauth2.clientId && this.oauth2.clientSecret) {
      return this.loginByOAuth2(username, password);
    }

    return this.loginBySoap(username, password);
  }
  /**
   * Login by OAuth2 username & password flow
   */


  async loginByOAuth2(username, password) {
    const res = await this.oauth2.authenticate(username, password);
    const userInfo = parseIdUrl(res.id);

    this._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      userInfo
    });

    this._logger.info(`<login> completed. user id = ${userInfo.id}, org id = ${userInfo.organizationId}`);

    return userInfo;
  }
  /**
   *
   */


  async loginBySoap(username, password) {
    var _context3;

    if (!username || !password) {
      return _promise.default.reject(new Error('no username password given'));
    }

    const body = ['<se:Envelope xmlns:se="http://schemas.xmlsoap.org/soap/envelope/">', '<se:Header/>', '<se:Body>', '<login xmlns="urn:partner.soap.sforce.com">', `<username>${esc(username)}</username>`, `<password>${esc(password)}</password>`, '</login>', '</se:Body>', '</se:Envelope>'].join('');
    const soapLoginEndpoint = [this.loginUrl, 'services/Soap/u', this.version].join('/');
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: soapLoginEndpoint,
      body,
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: '""'
      }
    });
    let m;

    if (response.statusCode >= 400) {
      m = response.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const faultstring = m && m[1];
      throw new Error(faultstring || response.body);
    }

    this._logger.debug(`SOAP response = ${response.body}`);

    m = response.body.match(/<serverUrl>([^<]+)<\/serverUrl>/);
    const serverUrl = m && m[1];
    m = response.body.match(/<sessionId>([^<]+)<\/sessionId>/);
    const sessionId = m && m[1];
    m = response.body.match(/<userId>([^<]+)<\/userId>/);
    const userId = m && m[1];
    m = response.body.match(/<organizationId>([^<]+)<\/organizationId>/);
    const organizationId = m && m[1];

    if (!serverUrl || !sessionId || !userId || !organizationId) {
      throw new Error('could not extract session information from login response');
    }

    const idUrl = [this.loginUrl, 'id', organizationId, userId].join('/');
    const userInfo = {
      id: userId,
      organizationId,
      url: idUrl
    };

    this._establish({
      serverUrl: (0, _slice.default)(_context3 = serverUrl.split('/')).call(_context3, 0, 3).join('/'),
      sessionId,
      userInfo
    });

    this._logger.info(`<login> completed. user id = ${userId}, org id = ${organizationId}`);

    return userInfo;
  }
  /**
   * Logout the current session
   */


  async logout(revoke) {
    this._refreshDelegate = undefined;

    if (this._sessionType === 'oauth2') {
      return this.logoutByOAuth2(revoke);
    }

    return this.logoutBySoap(revoke);
  }
  /**
   * Logout the current session by revoking access token via OAuth2 session revoke
   */


  async logoutByOAuth2(revoke) {
    const token = revoke ? this.refreshToken : this.accessToken;

    if (token) {
      await this.oauth2.revokeToken(token);
    } // Destroy the session bound to this connection


    this._clearSession();

    this._resetInstance();
  }
  /**
   * Logout the session by using SOAP web service API
   */


  async logoutBySoap(revoke) {
    const body = ['<se:Envelope xmlns:se="http://schemas.xmlsoap.org/soap/envelope/">', '<se:Header>', '<SessionHeader xmlns="urn:partner.soap.sforce.com">', `<sessionId>${esc(revoke ? this.refreshToken : this.accessToken)}</sessionId>`, '</SessionHeader>', '</se:Header>', '<se:Body>', '<logout xmlns="urn:partner.soap.sforce.com"/>', '</se:Body>', '</se:Envelope>'].join('');
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: [this.instanceUrl, 'services/Soap/u', this.version].join('/'),
      body,
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: '""'
      }
    });

    this._logger.debug(`SOAP statusCode = ${response.statusCode}, response = ${response.body}`);

    if (response.statusCode >= 400) {
      const m = response.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const faultstring = m && m[1];
      throw new Error(faultstring || response.body);
    } // Destroy the session bound to this connection


    this._clearSession();

    this._resetInstance();
  }
  /**
   * Send REST API request with given HTTP request info, with connected session information.
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  request(request, options = {}) {
    // if request is simple string, regard it as url in GET method
    let request_ = typeof request === 'string' ? {
      method: 'GET',
      url: request
    } : request; // if url is given in relative path, prepend base url or instance url before.

    request_ = _objectSpread(_objectSpread({}, request_), {}, {
      url: this._normalizeUrl(request_.url)
    });
    const httpApi = new _httpApi.default(this, options); // log api usage and its quota

    httpApi.on('response', response => {
      if (response.headers && response.headers['sforce-limit-info']) {
        const apiUsage = response.headers['sforce-limit-info'].match(/api-usage=(\d+)\/(\d+)/);

        if (apiUsage) {
          this.limitInfo = {
            apiUsage: {
              used: (0, _parseInt2.default)(apiUsage[1], 10),
              limit: (0, _parseInt2.default)(apiUsage[2], 10)
            }
          };
        }
      }
    });
    return httpApi.request(request_);
  }
  /**
   * Send HTTP GET request
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  requestGet(url, options) {
    const request = {
      method: 'GET',
      url
    };
    return this.request(request, options);
  }
  /**
   * Send HTTP POST request with JSON body, with connected session information
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  requestPost(url, body, options) {
    const request = {
      method: 'POST',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }
  /**
   * Send HTTP PUT request with JSON body, with connected session information
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  requestPut(url, body, options) {
    const request = {
      method: 'PUT',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }
  /**
   * Send HTTP PATCH request with JSON body
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  requestPatch(url, body, options) {
    const request = {
      method: 'PATCH',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }
  /**
   * Send HTTP DELETE request
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */


  requestDelete(url, options) {
    const request = {
      method: 'DELETE',
      url
    };
    return this.request(request, options);
  }
  /** @private **/


  _baseUrl() {
    return [this.instanceUrl, 'services/data', `v${this.version}`].join('/');
  }
  /**
   * Convert path to absolute url
   * @private
   */


  _normalizeUrl(url) {
    if (url[0] === '/') {
      if ((0, _indexOf.default)(url).call(url, this.instanceUrl + '/services/') === 0) {
        return url;
      }

      if ((0, _indexOf.default)(url).call(url, '/services/') === 0) {
        return this.instanceUrl + url;
      }

      return this._baseUrl() + url;
    }

    return url;
  }
  /**
   *
   */


  query(soql, options) {
    return new _query.default(this, soql, options);
  }
  /**
   * Execute search by SOSL
   *
   * @param {String} sosl - SOSL string
   * @param {Callback.<Array.<RecordResult>>} [callback] - Callback function
   * @returns {Promise.<Array.<RecordResult>>}
   */


  search(sosl) {
    var url = this._baseUrl() + '/search?q=' + encodeURIComponent(sosl);
    return this.request(url);
  }
  /**
   *
   */


  queryMore(locator, options) {
    return new _query.default(this, {
      locator
    }, options);
  }
  /* */


  _ensureVersion(majorVersion) {
    const versions = this.version.split('.');
    return (0, _parseInt2.default)(versions[0], 10) >= majorVersion;
  }
  /* */


  _supports(feature) {
    switch (feature) {
      case 'sobject-collection':
        // sobject collection is available only in API ver 42.0+
        return this._ensureVersion(42);

      default:
        return false;
    }
  }
  /**
   * Retrieve specified records
   */


  async retrieve(type, ids, options = {}) {
    return (0, _isArray.default)(ids) ? // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._retrieveMany(type, ids, options) : this._retrieveParallel(type, ids, options) : this._retrieveSingle(type, ids, options);
  }
  /** @private */


  async _retrieveSingle(type, id, options) {
    if (!id) {
      throw new Error('Invalid record ID. Specify valid record ID value');
    }

    let url = [this._baseUrl(), 'sobjects', type, id].join('/');
    const {
      fields,
      headers
    } = options;

    if (fields) {
      url += `?fields=${fields.join(',')}`;
    }

    return this.request({
      method: 'GET',
      url,
      headers
    });
  }
  /** @private */


  async _retrieveParallel(type, ids, options) {
    if (ids.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }

    return _promise.default.all((0, _map.default)(ids).call(ids, id => this._retrieveSingle(type, id, options).catch(err => {
      if (options.allOrNone || err.errorCode !== 'NOT_FOUND') {
        throw err;
      }

      return null;
    })));
  }
  /** @private */


  async _retrieveMany(type, ids, options) {
    var _context4;

    if (ids.length === 0) {
      return [];
    }

    const url = [this._baseUrl(), 'composite', 'sobjects', type].join('/');
    const fields = options.fields || (0, _map.default)(_context4 = (await this.describe$(type)).fields).call(_context4, field => field.name);
    return this.request({
      method: 'POST',
      url,
      body: (0, _stringify.default)({
        ids,
        fields
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }
  /**
   * Create records
   */


  /**
   * @param type
   * @param records
   * @param options
   */
  async create(type, records, options = {}) {
    const ret = (0, _isArray.default)(records) ? // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? await this._createMany(type, records, options) : await this._createParallel(type, records, options) : await this._createSingle(type, records, options);
    return ret;
  }
  /** @private */


  async _createSingle(type, record, options) {
    const {
      Id,
      type: rtype,
      attributes
    } = record,
          rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
    const sobjectType = type || attributes && attributes.type || rtype;

    if (!sobjectType) {
      throw new Error('No SObject Type defined in record');
    }

    const url = [this._baseUrl(), 'sobjects', sobjectType].join('/');
    return this.request({
      method: 'POST',
      url,
      body: (0, _stringify.default)(rec),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }
  /** @private */


  async _createParallel(type, records, options) {
    if (records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }

    return _promise.default.all((0, _map.default)(records).call(records, record => this._createSingle(type, record, options).catch(err => {
      // be aware that allOrNone in parallel mode will not revert the other successful requests
      // it only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }

      return toSaveResult(err);
    })));
  }
  /** @private */


  async _createMany(type, records, options) {
    if (records.length === 0) {
      return _promise.default.resolve([]);
    }

    if (records.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._createMany(type, (0, _slice.default)(records).call(records, 0, MAX_DML_COUNT), options)), ...(await this._createMany(type, (0, _slice.default)(records).call(records, MAX_DML_COUNT), options))];
    }

    const _records = (0, _map.default)(records).call(records, record => {
      const {
        Id,
        type: rtype,
        attributes
      } = record,
            rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
      const sobjectType = type || attributes && attributes.type || rtype;

      if (!sobjectType) {
        throw new Error('No SObject Type defined in record');
      }

      return _objectSpread({
        attributes: {
          type: sobjectType
        }
      }, rec);
    });

    const url = [this._baseUrl(), 'composite', 'sobjects'].join('/');
    return this.request({
      method: 'POST',
      url,
      body: (0, _stringify.default)({
        allOrNone: options.allOrNone || false,
        records: _records
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }
  /**
   * Synonym of Connection#create()
   */


  /**
   * @param type
   * @param records
   * @param options
   */
  update(type, records, options = {}) {
    return (0, _isArray.default)(records) ? // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._updateMany(type, records, options) : this._updateParallel(type, records, options) : this._updateSingle(type, records, options);
  }
  /** @private */


  async _updateSingle(type, record, options) {
    const {
      Id: id,
      type: rtype,
      attributes
    } = record,
          rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);

    if (!id) {
      throw new Error('Record id is not found in record.');
    }

    const sobjectType = type || attributes && attributes.type || rtype;

    if (!sobjectType) {
      throw new Error('No SObject Type defined in record');
    }

    const url = [this._baseUrl(), 'sobjects', sobjectType, id].join('/');
    return this.request({
      method: 'PATCH',
      url,
      body: (0, _stringify.default)(rec),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    }, {
      noContentResponse: {
        id,
        success: true,
        errors: []
      }
    });
  }
  /** @private */


  async _updateParallel(type, records, options) {
    if (records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }

    return _promise.default.all((0, _map.default)(records).call(records, record => this._updateSingle(type, record, options).catch(err => {
      // be aware that allOrNone in parallel mode will not revert the other successful requests
      // it only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }

      return toSaveResult(err);
    })));
  }
  /** @private */


  async _updateMany(type, records, options) {
    if (records.length === 0) {
      return [];
    }

    if (records.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._updateMany(type, (0, _slice.default)(records).call(records, 0, MAX_DML_COUNT), options)), ...(await this._updateMany(type, (0, _slice.default)(records).call(records, MAX_DML_COUNT), options))];
    }

    const _records = (0, _map.default)(records).call(records, record => {
      const {
        Id: id,
        type: rtype,
        attributes
      } = record,
            rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);

      if (!id) {
        throw new Error('Record id is not found in record.');
      }

      const sobjectType = type || attributes && attributes.type || rtype;

      if (!sobjectType) {
        throw new Error('No SObject Type defined in record');
      }

      return _objectSpread({
        id,
        attributes: {
          type: sobjectType
        }
      }, rec);
    });

    const url = [this._baseUrl(), 'composite', 'sobjects'].join('/');
    return this.request({
      method: 'PATCH',
      url,
      body: (0, _stringify.default)({
        allOrNone: options.allOrNone || false,
        records: _records
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }
  /**
   * Upsert records
   */


  /**
   *
   * @param type
   * @param records
   * @param extIdField
   * @param options
   */
  async upsert(type, records, extIdField, options = {}) {
    const isArray = (0, _isArray.default)(records);

    const _records = (0, _isArray.default)(records) ? records : [records];

    if (_records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }

    const results = await _promise.default.all((0, _map.default)(_records).call(_records, record => {
      var _context5;

      const {
        [extIdField]: extId,
        type: rtype,
        attributes
      } = record,
            rec = (0, _objectWithoutProperties2.default)(record, (0, _map.default)(_context5 = [extIdField, "type", "attributes"]).call(_context5, _toPropertyKey));
      const url = [this._baseUrl(), 'sobjects', type, extIdField, extId].join('/');
      return this.request({
        method: 'PATCH',
        url,
        body: (0, _stringify.default)(rec),
        headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
          'content-type': 'application/json'
        })
      }, {
        noContentResponse: {
          success: true,
          errors: []
        }
      }).catch(err => {
        // Be aware that `allOrNone` option in upsert method
        // will not revert the other successful requests.
        // It only raises error when met at least one failed request.
        if (!isArray || options.allOrNone || !err.errorCode) {
          throw err;
        }

        return toSaveResult(err);
      });
    }));
    return isArray ? results : results[0];
  }
  /**
   * Delete records
   */


  /**
   * @param type
   * @param ids
   * @param options
   */
  async destroy(type, ids, options = {}) {
    return (0, _isArray.default)(ids) ? // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._destroyMany(type, ids, options) : this._destroyParallel(type, ids, options) : this._destroySingle(type, ids, options);
  }
  /** @private */


  async _destroySingle(type, id, options) {
    const url = [this._baseUrl(), 'sobjects', type, id].join('/');
    return this.request({
      method: 'DELETE',
      url,
      headers: options.headers || {}
    }, {
      noContentResponse: {
        id,
        success: true,
        errors: []
      }
    });
  }
  /** @private */


  async _destroyParallel(type, ids, options) {
    if (ids.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }

    return _promise.default.all((0, _map.default)(ids).call(ids, id => this._destroySingle(type, id, options).catch(err => {
      // Be aware that `allOrNone` option in parallel mode
      // will not revert the other successful requests.
      // It only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }

      return toSaveResult(err);
    })));
  }
  /** @private */


  async _destroyMany(type, ids, options) {
    if (ids.length === 0) {
      return [];
    }

    if (ids.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._destroyMany(type, (0, _slice.default)(ids).call(ids, 0, MAX_DML_COUNT), options)), ...(await this._destroyMany(type, (0, _slice.default)(ids).call(ids, MAX_DML_COUNT), options))];
    }

    let url = [this._baseUrl(), 'composite', 'sobjects?ids='].join('/') + ids.join(',');

    if (options.allOrNone) {
      url += '&allOrNone=true';
    }

    return this.request({
      method: 'DELETE',
      url,
      headers: options.headers || {}
    });
  }
  /**
   * Synonym of Connection#destroy()
   */


  /**
   * Describe SObject metadata
   */
  async describe(type) {
    const url = [this._baseUrl(), 'sobjects', type, 'describe'].join('/');
    const body = await this.request(url);
    return body;
  }
  /**
   * Describe global SObjects
   */


  async describeGlobal() {
    const url = `${this._baseUrl()}/sobjects`;
    const body = await this.request(url);
    return body;
  }
  /**
   * Get SObject instance
   */


  sobject(type) {
    const so = this.sobjects[type] || new _sobject.default(this, type);
    this.sobjects[type] = so;
    return so;
  }
  /**
   * Get identity information of current user
   */


  async identity(options = {}) {
    let url = this.userInfo && this.userInfo.url;

    if (!url) {
      const res = await this.request({
        method: 'GET',
        url: this._baseUrl(),
        headers: options.headers
      });
      url = res.identity;
    }

    url += '?format=json';

    if (this.accessToken) {
      url += `&oauth_token=${encodeURIComponent(this.accessToken)}`;
    }

    const res = await this.request({
      method: 'GET',
      url
    });
    this.userInfo = {
      id: res.user_id,
      organizationId: res.organization_id,
      url: res.id
    };
    return res;
  }
  /**
   * List recently viewed records
   */


  async recent(type, limit) {
    /* eslint-disable no-param-reassign */
    if (typeof type === 'number') {
      limit = type;
      type = undefined;
    }

    let url;

    if (type) {
      url = [this._baseUrl(), 'sobjects', type].join('/');
      const {
        recentItems
      } = await this.request(url);
      return limit ? (0, _slice.default)(recentItems).call(recentItems, 0, limit) : recentItems;
    }

    url = `${this._baseUrl()}/recent`;

    if (limit) {
      url += `?limit=${limit}`;
    }

    return this.request(url);
  }
  /**
   * Retrieve updated records
   */


  async updated(type, start, end) {
    /* eslint-disable no-param-reassign */
    let url = [this._baseUrl(), 'sobjects', type, 'updated'].join('/');

    if (typeof start === 'string') {
      start = new Date(start);
    }

    start = (0, _formatter.formatDate)(start);
    url += `?start=${encodeURIComponent(start)}`;

    if (typeof end === 'string') {
      end = new Date(end);
    }

    end = (0, _formatter.formatDate)(end);
    url += `&end=${encodeURIComponent(end)}`;
    const body = await this.request(url);
    return body;
  }
  /**
   * Retrieve deleted records
   */


  async deleted(type, start, end) {
    /* eslint-disable no-param-reassign */
    let url = [this._baseUrl(), 'sobjects', type, 'deleted'].join('/');

    if (typeof start === 'string') {
      start = new Date(start);
    }

    start = (0, _formatter.formatDate)(start);
    url += `?start=${encodeURIComponent(start)}`;

    if (typeof end === 'string') {
      end = new Date(end);
    }

    end = (0, _formatter.formatDate)(end);
    url += `&end=${encodeURIComponent(end)}`;
    const body = await this.request(url);
    return body;
  }
  /**
   * Returns a list of all tabs
   */


  async tabs() {
    const url = [this._baseUrl(), 'tabs'].join('/');
    const body = await this.request(url);
    return body;
  }
  /**
   * Returns current system limit in the organization
   */


  async limits() {
    const url = [this._baseUrl(), 'limits'].join('/');
    const body = await this.request(url);
    return body;
  }
  /**
   * Returns a theme info
   */


  async theme() {
    const url = [this._baseUrl(), 'theme'].join('/');
    const body = await this.request(url);
    return body;
  }
  /**
   * Returns all registered global quick actions
   */


  async quickActions() {
    const body = await this.request('/quickActions');
    return body;
  }
  /**
   * Get reference for specified global quick action
   */


  quickAction(actionName) {
    return new _quickAction.default(this, `/quickActions/${actionName}`);
  }
  /**
   * Module which manages process rules and approval processes
   */


}

exports.Connection = Connection;
(0, _defineProperty2.default)(Connection, "_logger", (0, _logger.getLogger)('connection'));
var _default = Connection;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb25uZWN0aW9uLnRzIl0sIm5hbWVzIjpbImRlZmF1bHRDb25uZWN0aW9uQ29uZmlnIiwibG9naW5VcmwiLCJpbnN0YW5jZVVybCIsInZlcnNpb24iLCJsb2dMZXZlbCIsIm1heFJlcXVlc3QiLCJlc2MiLCJzdHIiLCJTdHJpbmciLCJyZXBsYWNlIiwicGFyc2VTaWduZWRSZXF1ZXN0Iiwic3IiLCJKU09OIiwicGFyc2UiLCJtc2ciLCJzcGxpdCIsInBvcCIsIkVycm9yIiwianNvbiIsIkJ1ZmZlciIsImZyb20iLCJ0b1N0cmluZyIsInBhcnNlSWRVcmwiLCJ1cmwiLCJvcmdhbml6YXRpb25JZCIsImlkIiwib2F1dGhSZWZyZXNoRm4iLCJjb25uIiwiY2FsbGJhY2siLCJyZWZyZXNoVG9rZW4iLCJyZXMiLCJvYXV0aDIiLCJ1c2VySW5mbyIsIl9lc3RhYmxpc2giLCJpbnN0YW5jZV91cmwiLCJhY2Nlc3NUb2tlbiIsImFjY2Vzc190b2tlbiIsInVuZGVmaW5lZCIsImVyciIsImNyZWF0ZVVzZXJuYW1lUGFzc3dvcmRSZWZyZXNoRm4iLCJ1c2VybmFtZSIsInBhc3N3b3JkIiwibG9naW4iLCJ0b1NhdmVSZXN1bHQiLCJzdWNjZXNzIiwiZXJyb3JzIiwicmFpc2VOb01vZHVsZUVycm9yIiwibmFtZSIsIk1BWF9ETUxfQ09VTlQiLCJDb25uZWN0aW9uIiwiRXZlbnRFbWl0dGVyIiwiYW5hbHl0aWNzIiwiYXBleCIsImJ1bGsiLCJidWxrMiIsImNoYXR0ZXIiLCJtZXRhZGF0YSIsInNvYXAiLCJzdHJlYW1pbmciLCJ0b29saW5nIiwiY29uc3RydWN0b3IiLCJjb25maWciLCJjcmVhdGUiLCJkZXN0cm95IiwiUHJvY2VzcyIsInByb3h5VXJsIiwiaHR0cFByb3h5IiwiT0F1dGgyIiwicmVmcmVzaEZuIiwiY2xpZW50SWQiLCJfcmVmcmVzaERlbGVnYXRlIiwiU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZSIsIl9tYXhSZXF1ZXN0IiwiX2xvZ2dlciIsImNyZWF0ZUluc3RhbmNlIiwiX2xvZ0xldmVsIiwiX3RyYW5zcG9ydCIsIlhkUHJveHlUcmFuc3BvcnQiLCJIdHRwUHJveHlUcmFuc3BvcnQiLCJUcmFuc3BvcnQiLCJfY2FsbE9wdGlvbnMiLCJjYWxsT3B0aW9ucyIsImNhY2hlIiwiQ2FjaGUiLCJkZXNjcmliZUNhY2hlS2V5IiwidHlwZSIsImRlc2NyaWJlIiwicHJvdG90eXBlIiwiY3JlYXRlQ2FjaGVkRnVuY3Rpb24iLCJrZXkiLCJzdHJhdGVneSIsImRlc2NyaWJlJCIsImRlc2NyaWJlJCQiLCJkZXNjcmliZVNPYmplY3QiLCJkZXNjcmliZVNPYmplY3QkIiwiZGVzY3JpYmVTT2JqZWN0JCQiLCJkZXNjcmliZUdsb2JhbCIsImRlc2NyaWJlR2xvYmFsJCIsImRlc2NyaWJlR2xvYmFsJCQiLCJzZXNzaW9uSWQiLCJzZXJ2ZXJVcmwiLCJzaWduZWRSZXF1ZXN0IiwianNmb3JjZSIsImVtaXQiLCJvcHRpb25zIiwiam9pbiIsInNpZ25lZFJlcXVlc3RPYmplY3QiLCJjbGllbnQiLCJvYXV0aFRva2VuIiwiQ2FudmFzVHJhbnNwb3J0Iiwic3VwcG9ydGVkIiwiX3Nlc3Npb25UeXBlIiwiX3Jlc2V0SW5zdGFuY2UiLCJfY2xlYXJTZXNzaW9uIiwibGltaXRJbmZvIiwic29iamVjdHMiLCJjbGVhciIsImdldCIsInJlbW92ZUFsbExpc3RlbmVycyIsIm9uIiwicmVzdWx0Iiwic28iLCJzb2JqZWN0IiwiYXV0aG9yaXplIiwiY29kZSIsInBhcmFtcyIsInJlcXVlc3RUb2tlbiIsInJlZnJlc2hfdG9rZW4iLCJkZWJ1ZyIsImNsaWVudFNlY3JldCIsImxvZ2luQnlPQXV0aDIiLCJsb2dpbkJ5U29hcCIsImF1dGhlbnRpY2F0ZSIsImluZm8iLCJyZWplY3QiLCJib2R5Iiwic29hcExvZ2luRW5kcG9pbnQiLCJyZXNwb25zZSIsImh0dHBSZXF1ZXN0IiwibWV0aG9kIiwiaGVhZGVycyIsIlNPQVBBY3Rpb24iLCJtIiwic3RhdHVzQ29kZSIsIm1hdGNoIiwiZmF1bHRzdHJpbmciLCJ1c2VySWQiLCJpZFVybCIsImxvZ291dCIsInJldm9rZSIsImxvZ291dEJ5T0F1dGgyIiwibG9nb3V0QnlTb2FwIiwidG9rZW4iLCJyZXZva2VUb2tlbiIsInJlcXVlc3QiLCJyZXF1ZXN0XyIsIl9ub3JtYWxpemVVcmwiLCJodHRwQXBpIiwiSHR0cEFwaSIsImFwaVVzYWdlIiwidXNlZCIsImxpbWl0IiwicmVxdWVzdEdldCIsInJlcXVlc3RQb3N0IiwicmVxdWVzdFB1dCIsInJlcXVlc3RQYXRjaCIsInJlcXVlc3REZWxldGUiLCJfYmFzZVVybCIsInF1ZXJ5Iiwic29xbCIsIlF1ZXJ5Iiwic2VhcmNoIiwic29zbCIsImVuY29kZVVSSUNvbXBvbmVudCIsInF1ZXJ5TW9yZSIsImxvY2F0b3IiLCJfZW5zdXJlVmVyc2lvbiIsIm1ham9yVmVyc2lvbiIsInZlcnNpb25zIiwiX3N1cHBvcnRzIiwiZmVhdHVyZSIsInJldHJpZXZlIiwiaWRzIiwiX3JldHJpZXZlTWFueSIsIl9yZXRyaWV2ZVBhcmFsbGVsIiwiX3JldHJpZXZlU2luZ2xlIiwiZmllbGRzIiwibGVuZ3RoIiwiYWxsIiwiY2F0Y2giLCJhbGxPck5vbmUiLCJlcnJvckNvZGUiLCJmaWVsZCIsInJlY29yZHMiLCJyZXQiLCJfY3JlYXRlTWFueSIsIl9jcmVhdGVQYXJhbGxlbCIsIl9jcmVhdGVTaW5nbGUiLCJyZWNvcmQiLCJJZCIsInJ0eXBlIiwiYXR0cmlidXRlcyIsInJlYyIsInNvYmplY3RUeXBlIiwicmVzb2x2ZSIsImFsbG93UmVjdXJzaXZlIiwiX3JlY29yZHMiLCJ1cGRhdGUiLCJfdXBkYXRlTWFueSIsIl91cGRhdGVQYXJhbGxlbCIsIl91cGRhdGVTaW5nbGUiLCJub0NvbnRlbnRSZXNwb25zZSIsInVwc2VydCIsImV4dElkRmllbGQiLCJpc0FycmF5IiwicmVzdWx0cyIsImV4dElkIiwiX2Rlc3Ryb3lNYW55IiwiX2Rlc3Ryb3lQYXJhbGxlbCIsIl9kZXN0cm95U2luZ2xlIiwiU09iamVjdCIsImlkZW50aXR5IiwidXNlcl9pZCIsIm9yZ2FuaXphdGlvbl9pZCIsInJlY2VudCIsInJlY2VudEl0ZW1zIiwidXBkYXRlZCIsInN0YXJ0IiwiZW5kIiwiRGF0ZSIsImRlbGV0ZWQiLCJ0YWJzIiwibGltaXRzIiwidGhlbWUiLCJxdWlja0FjdGlvbnMiLCJxdWlja0FjdGlvbiIsImFjdGlvbk5hbWUiLCJRdWlja0FjdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0E7O0FBQ0E7O0FBZ0NBOztBQUtBOztBQUVBOztBQUVBOztBQUNBOztBQUNBOztBQUdBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7Ozs7O0FBMkNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLHVCQU1MLEdBQUc7QUFDRkMsRUFBQUEsUUFBUSxFQUFFLDhCQURSO0FBRUZDLEVBQUFBLFdBQVcsRUFBRSxFQUZYO0FBR0ZDLEVBQUFBLE9BQU8sRUFBRSxNQUhQO0FBSUZDLEVBQUFBLFFBQVEsRUFBRSxNQUpSO0FBS0ZDLEVBQUFBLFVBQVUsRUFBRTtBQUxWLENBTko7QUFjQTtBQUNBO0FBQ0E7O0FBQ0EsU0FBU0MsR0FBVCxDQUFhQyxHQUFiLEVBQTRDO0FBQzFDLFNBQU9DLE1BQU0sQ0FBQ0QsR0FBRyxJQUFJLEVBQVIsQ0FBTixDQUNKRSxPQURJLENBQ0ksSUFESixFQUNVLE9BRFYsRUFFSkEsT0FGSSxDQUVJLElBRkosRUFFVSxNQUZWLEVBR0pBLE9BSEksQ0FHSSxJQUhKLEVBR1UsTUFIVixFQUlKQSxPQUpJLENBSUksSUFKSixFQUlVLFFBSlYsQ0FBUDtBQUtEO0FBRUQ7QUFDQTtBQUNBOzs7QUFDQSxTQUFTQyxrQkFBVCxDQUE0QkMsRUFBNUIsRUFBc0U7QUFDcEUsTUFBSSxPQUFPQSxFQUFQLEtBQWMsUUFBbEIsRUFBNEI7QUFDMUIsUUFBSUEsRUFBRSxDQUFDLENBQUQsQ0FBRixLQUFVLEdBQWQsRUFBbUI7QUFDakI7QUFDQSxhQUFPQyxJQUFJLENBQUND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bkI7QUFDQSxXQUFPZ0gsSUFBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBOzs7QUFDRSxRQUFNaUcsTUFBTixHQUFnRDtBQUM5QyxVQUFNak4sR0FBRyxHQUFHLENBQUMsS0FBS2dKLFFBQUwsRUFBRCxFQUFrQixRQUFsQixFQUE0QjlELElBQTVCLENBQWlDLEdBQWpDLENBQVo7QUFDQSxVQUFNOEIsSUFBSSxHQUFHLE1BQU0sS0FBS21CLE9BQUwsQ0FBYW5JLEdBQWIsQ0FBbkI7QUFDQSxXQUFPZ0gsSUFBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBOzs7QUFDRSxRQUFNa0csS0FBTixHQUFzQztBQUNwQyxVQUFNbE4sR0FBRyxHQUFHLENBQUMsS0FBS2dKLFFBQUwsRUFBRCxFQUFrQixPQUFsQixFQUEyQjlELElBQTNCLENBQWdDLEdBQWhDLENBQVo7QUFDQSxVQUFNOEIsSUFBSSxHQUFHLE1BQU0sS0FBS21CLE9BQUwsQ0FBYW5JLEdBQWIsQ0FBbkI7QUFDQSxXQUFPZ0gsSUFBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBOzs7QUFDRSxRQUFNbUcsWUFBTixHQUEyRDtBQUN6RCxVQUFNbkcsSUFBSSxHQUFHLE1BQU0sS0FBS21CLE9BQUwsQ0FBYSxlQUFiLENBQW5CO0FBQ0EsV0FBT25CLElBQVA7QUFDRDtBQUVEO0FBQ0Y7QUFDQTs7O0FBQ0VvRyxFQUFBQSxXQUFXLENBQUNDLFVBQUQsRUFBcUM7QUFDOUMsV0FBTyxJQUFJQyxvQkFBSixDQUFnQixJQUFoQixFQUF1QixpQkFBZ0JELFVBQVcsRUFBbEQsQ0FBUDtBQUNEO0FBRUQ7QUFDRjtBQUNBOzs7QUFuekN3RTs7OzhCQUEzRDNMLFUsYUFDTSx1QkFBVSxZQUFWLEM7ZUFzekNKQSxVIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICovXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IGpzZm9yY2UgZnJvbSAnLi9qc2ZvcmNlJztcbmltcG9ydCB7XG4gIEh0dHBSZXF1ZXN0LFxuICBIdHRwUmVzcG9uc2UsXG4gIENhbGxiYWNrLFxuICBSZWNvcmQsXG4gIFNhdmVSZXN1bHQsXG4gIFVwc2VydFJlc3VsdCxcbiAgRGVzY3JpYmVHbG9iYWxSZXN1bHQsXG4gIERlc2NyaWJlU09iamVjdFJlc3VsdCxcbiAgRGVzY3JpYmVUYWIsXG4gIERlc2NyaWJlVGhlbWUsXG4gIERlc2NyaWJlUXVpY2tBY3Rpb25SZXN1bHQsXG4gIFVwZGF0ZWRSZXN1bHQsXG4gIERlbGV0ZWRSZXN1bHQsXG4gIFNlYXJjaFJlc3VsdCxcbiAgT3JnYW5pemF0aW9uTGltaXRzSW5mbyxcbiAgT3B0aW9uYWwsXG4gIFNpZ25lZFJlcXVlc3RPYmplY3QsXG4gIFNhdmVFcnJvcixcbiAgRG1sT3B0aW9ucyxcbiAgUmV0cmlldmVPcHRpb25zLFxuICBTY2hlbWEsXG4gIFNPYmplY3ROYW1lcyxcbiAgU09iamVjdElucHV0UmVjb3JkLFxuICBTT2JqZWN0VXBkYXRlUmVjb3JkLFxuICBTT2JqZWN0RmllbGROYW1lcyxcbiAgVXNlckluZm8sXG4gIElkZW50aXR5SW5mbyxcbiAgTGltaXRJbmZvLFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFN0cmVhbVByb21pc2UgfSBmcm9tICcuL3V0aWwvcHJvbWlzZSc7XG5pbXBvcnQgVHJhbnNwb3J0LCB7XG4gIENhbnZhc1RyYW5zcG9ydCxcbiAgWGRQcm94eVRyYW5zcG9ydCxcbiAgSHR0cFByb3h5VHJhbnNwb3J0LFxufSBmcm9tICcuL3RyYW5zcG9ydCc7XG5pbXBvcnQgeyBMb2dnZXIsIGdldExvZ2dlciB9IGZyb20gJy4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHsgTG9nTGV2ZWxDb25maWcgfSBmcm9tICcuL3V0aWwvbG9nZ2VyJztcbmltcG9ydCBPQXV0aDIsIHsgVG9rZW5SZXNwb25zZSB9IGZyb20gJy4vb2F1dGgyJztcbmltcG9ydCB7IE9BdXRoMkNvbmZpZyB9IGZyb20gJy4vb2F1dGgyJztcbmltcG9ydCBDYWNoZSwgeyBDYWNoZWRGdW5jdGlvbiB9IGZyb20gJy4vY2FjaGUnO1xuaW1wb3J0IEh0dHBBcGkgZnJvbSAnLi9odHRwLWFwaSc7XG5pbXBvcnQgU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZSwge1xuICBTZXNzaW9uUmVmcmVzaEZ1bmMsXG59IGZyb20gJy4vc2Vzc2lvbi1yZWZyZXNoLWRlbGVnYXRlJztcbmltcG9ydCBRdWVyeSBmcm9tICcuL3F1ZXJ5JztcbmltcG9ydCB7IFF1ZXJ5T3B0aW9ucyB9IGZyb20gJy4vcXVlcnknO1xuaW1wb3J0IFNPYmplY3QgZnJvbSAnLi9zb2JqZWN0JztcbmltcG9ydCBRdWlja0FjdGlvbiBmcm9tICcuL3F1aWNrLWFjdGlvbic7XG5pbXBvcnQgUHJvY2VzcyBmcm9tICcuL3Byb2Nlc3MnO1xuaW1wb3J0IHsgZm9ybWF0RGF0ZSB9IGZyb20gJy4vdXRpbC9mb3JtYXR0ZXInO1xuaW1wb3J0IEFuYWx5dGljcyBmcm9tICcuL2FwaS9hbmFseXRpY3MnO1xuaW1wb3J0IEFwZXggZnJvbSAnLi9hcGkvYXBleCc7XG5pbXBvcnQgeyBCdWxrLCBCdWxrVjIgfSBmcm9tICcuL2FwaS9idWxrJztcbmltcG9ydCBDaGF0dGVyIGZyb20gJy4vYXBpL2NoYXR0ZXInO1xuaW1wb3J0IE1ldGFkYXRhIGZyb20gJy4vYXBpL21ldGFkYXRhJztcbmltcG9ydCBTb2FwQXBpIGZyb20gJy4vYXBpL3NvYXAnO1xuaW1wb3J0IFN0cmVhbWluZyBmcm9tICcuL2FwaS9zdHJlYW1pbmcnO1xuaW1wb3J0IFRvb2xpbmcgZnJvbSAnLi9hcGkvdG9vbGluZyc7XG5pbXBvcnQgeyBKd3RPQXV0aDJDb25maWcsIEp3dE9BdXRoMiB9IGZyb20gJy4vand0T0F1dGgyJztcblxuLyoqXG4gKiB0eXBlIGRlZmluaXRpb25zXG4gKi9cbmV4cG9ydCB0eXBlIENvbm5lY3Rpb25Db25maWc8UyBleHRlbmRzIFNjaGVtYSA9IFNjaGVtYT4gPSB7XG4gIHZlcnNpb24/OiBzdHJpbmc7XG4gIGxvZ2luVXJsPzogc3RyaW5nO1xuICBhY2Nlc3NUb2tlbj86IHN0cmluZztcbiAgcmVmcmVzaFRva2VuPzogc3RyaW5nO1xuICBpbnN0YW5jZVVybD86IHN0cmluZztcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBzZXJ2ZXJVcmw/OiBzdHJpbmc7XG4gIHNpZ25lZFJlcXVlc3Q/OiBzdHJpbmc7XG4gIG9hdXRoMj86IE9BdXRoMiB8IE9BdXRoMkNvbmZpZztcbiAgand0T0F1dGgyPzogSnd0T0F1dGgyIHwgSnd0T0F1dGgyQ29uZmlnO1xuICBtYXhSZXF1ZXN0PzogbnVtYmVyO1xuICBwcm94eVVybD86IHN0cmluZztcbiAgaHR0cFByb3h5Pzogc3RyaW5nO1xuICBsb2dMZXZlbD86IExvZ0xldmVsQ29uZmlnO1xuICBjYWxsT3B0aW9ucz86IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB9O1xuICByZWZyZXNoRm4/OiBTZXNzaW9uUmVmcmVzaEZ1bmM8Uz47XG59O1xuXG5leHBvcnQgdHlwZSBDb25uZWN0aW9uRXN0YWJsaXNoT3B0aW9ucyA9IHtcbiAgYWNjZXNzVG9rZW4/OiBPcHRpb25hbDxzdHJpbmc+O1xuICByZWZyZXNoVG9rZW4/OiBPcHRpb25hbDxzdHJpbmc+O1xuICBpbnN0YW5jZVVybD86IE9wdGlvbmFsPHN0cmluZz47XG4gIHNlc3Npb25JZD86IE9wdGlvbmFsPHN0cmluZz47XG4gIHNlcnZlclVybD86IE9wdGlvbmFsPHN0cmluZz47XG4gIHNpZ25lZFJlcXVlc3Q/OiBPcHRpb25hbDxzdHJpbmcgfCBTaWduZWRSZXF1ZXN0T2JqZWN0PjtcbiAgdXNlckluZm8/OiBPcHRpb25hbDxVc2VySW5mbz47XG59O1xuXG4vKipcbiAqXG4gKi9cbmNvbnN0IGRlZmF1bHRDb25uZWN0aW9uQ29uZmlnOiB7XG4gIGxvZ2luVXJsOiBzdHJpbmc7XG4gIGluc3RhbmNlVXJsOiBzdHJpbmc7XG4gIHZlcnNpb246IHN0cmluZztcbiAgbG9nTGV2ZWw6IExvZ0xldmVsQ29uZmlnO1xuICBtYXhSZXF1ZXN0OiBudW1iZXI7XG59ID0ge1xuICBsb2dpblVybDogJ2h0dHBzOi8vbG9naW4uc2FsZXNmb3JjZS5jb20nLFxuICBpbnN0YW5jZVVybDogJycsXG4gIHZlcnNpb246ICc1MC4wJyxcbiAgbG9nTGV2ZWw6ICdOT05FJyxcbiAgbWF4UmVxdWVzdDogMTAsXG59O1xuXG4vKipcbiAqXG4gKi9cbmZ1bmN0aW9uIGVzYyhzdHI6IE9wdGlvbmFsPHN0cmluZz4pOiBzdHJpbmcge1xuICByZXR1cm4gU3RyaW5nKHN0ciB8fCAnJylcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKTtcbn1cblxuLyoqXG4gKlxuICovXG5mdW5jdGlvbiBwYXJzZVNpZ25lZFJlcXVlc3Qoc3I6IHN0cmluZyB8IE9iamVjdCk6IFNpZ25lZFJlcXVlc3RPYmplY3Qge1xuICBpZiAodHlwZW9mIHNyID09PSAnc3RyaW5nJykge1xuICAgIGlmIChzclswXSA9PT0gJ3snKSB7XG4gICAgICAvLyBtaWdodCBiZSBKU09OXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzcik7XG4gICAgfSAvLyBtaWdodCBiZSBvcmlnaW5hbCBiYXNlNjQtZW5jb2RlZCBzaWduZWQgcmVxdWVzdFxuICAgIGNvbnN0IG1zZyA9IHNyLnNwbGl0KCcuJykucG9wKCk7IC8vIHJldHJpZXZlIGxhdHRlciBwYXJ0XG4gICAgaWYgKCFtc2cpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzaWduZWQgcmVxdWVzdCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uID0gQnVmZmVyLmZyb20obXNnLCAnYmFzZTY0JykudG9TdHJpbmcoJ3V0Zi04Jyk7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoanNvbik7XG4gIH1cbiAgcmV0dXJuIHNyIGFzIFNpZ25lZFJlcXVlc3RPYmplY3Q7XG59XG5cbi8qKiBAcHJpdmF0ZSAqKi9cbmZ1bmN0aW9uIHBhcnNlSWRVcmwodXJsOiBzdHJpbmcpIHtcbiAgY29uc3QgW29yZ2FuaXphdGlvbklkLCBpZF0gPSB1cmwuc3BsaXQoJy8nKS5zbGljZSgtMik7XG4gIHJldHVybiB7IGlkLCBvcmdhbml6YXRpb25JZCwgdXJsIH07XG59XG5cbi8qKlxuICogU2Vzc2lvbiBSZWZyZXNoIGRlbGVnYXRlIGZ1bmN0aW9uIGZvciBPQXV0aDIgYXV0aHogY29kZSBmbG93XG4gKiBAcHJpdmF0ZVxuICovXG5hc3luYyBmdW5jdGlvbiBvYXV0aFJlZnJlc2hGbjxTIGV4dGVuZHMgU2NoZW1hPihcbiAgY29ubjogQ29ubmVjdGlvbjxTPixcbiAgY2FsbGJhY2s6IENhbGxiYWNrPHN0cmluZywgVG9rZW5SZXNwb25zZT4sXG4pIHtcbiAgdHJ5IHtcbiAgICBpZiAoIWNvbm4ucmVmcmVzaFRva2VuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHJlZnJlc2ggdG9rZW4gZm91bmQgaW4gdGhlIGNvbm5lY3Rpb24nKTtcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgY29ubi5vYXV0aDIucmVmcmVzaFRva2VuKGNvbm4ucmVmcmVzaFRva2VuKTtcbiAgICBjb25zdCB1c2VySW5mbyA9IHBhcnNlSWRVcmwocmVzLmlkKTtcbiAgICBjb25uLl9lc3RhYmxpc2goe1xuICAgICAgaW5zdGFuY2VVcmw6IHJlcy5pbnN0YW5jZV91cmwsXG4gICAgICBhY2Nlc3NUb2tlbjogcmVzLmFjY2Vzc190b2tlbixcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0pO1xuICAgIGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVzLmFjY2Vzc190b2tlbiwgcmVzKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogU2Vzc2lvbiBSZWZyZXNoIGRlbGVnYXRlIGZ1bmN0aW9uIGZvciB1c2VybmFtZS9wYXNzd29yZCBsb2dpblxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVXNlcm5hbWVQYXNzd29yZFJlZnJlc2hGbjxTIGV4dGVuZHMgU2NoZW1hPihcbiAgdXNlcm5hbWU6IHN0cmluZyxcbiAgcGFzc3dvcmQ6IHN0cmluZyxcbikge1xuICByZXR1cm4gYXN5bmMgKFxuICAgIGNvbm46IENvbm5lY3Rpb248Uz4sXG4gICAgY2FsbGJhY2s6IENhbGxiYWNrPHN0cmluZywgVG9rZW5SZXNwb25zZT4sXG4gICkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBjb25uLmxvZ2luKHVzZXJuYW1lLCBwYXNzd29yZCk7XG4gICAgICBpZiAoIWNvbm4uYWNjZXNzVG9rZW4pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBY2Nlc3MgdG9rZW4gbm90IGZvdW5kIGFmdGVyIGxvZ2luJyk7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCBjb25uLmFjY2Vzc1Rva2VuKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiB0b1NhdmVSZXN1bHQoZXJyOiBTYXZlRXJyb3IpOiBTYXZlUmVzdWx0IHtcbiAgcmV0dXJuIHtcbiAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICBlcnJvcnM6IFtlcnJdLFxuICB9O1xufVxuXG4vKipcbiAqXG4gKi9cbmZ1bmN0aW9uIHJhaXNlTm9Nb2R1bGVFcnJvcihuYW1lOiBzdHJpbmcpOiBuZXZlciB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICBgQVBJIG1vZHVsZSAnJHtuYW1lfScgaXMgbm90IGxvYWRlZCwgbG9hZCAnanNmb3JjZS9hcGkvJHtuYW1lfScgZXhwbGljaXRseWAsXG4gICk7XG59XG5cbi8qXG4gKiBDb25zdGFudCBvZiBtYXhpbXVtIHJlY29yZHMgbnVtIGluIERNTCBvcGVyYXRpb24gKHVwZGF0ZS9kZWxldGUpXG4gKi9cbmNvbnN0IE1BWF9ETUxfQ09VTlQgPSAyMDA7XG5cbi8qKlxuICpcbiAqL1xuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb248UyBleHRlbmRzIFNjaGVtYSA9IFNjaGVtYT4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBzdGF0aWMgX2xvZ2dlciA9IGdldExvZ2dlcignY29ubmVjdGlvbicpO1xuXG4gIHZlcnNpb246IHN0cmluZztcbiAgbG9naW5Vcmw6IHN0cmluZztcbiAgaW5zdGFuY2VVcmw6IHN0cmluZztcbiAgYWNjZXNzVG9rZW46IE9wdGlvbmFsPHN0cmluZz47XG4gIHJlZnJlc2hUb2tlbjogT3B0aW9uYWw8c3RyaW5nPjtcbiAgdXNlckluZm86IE9wdGlvbmFsPFVzZXJJbmZvPjtcbiAgbGltaXRJbmZvOiBMaW1pdEluZm8gPSB7fTtcbiAgb2F1dGgyOiBPQXV0aDI7XG4gIHNvYmplY3RzOiB7IFtOIGluIFNPYmplY3ROYW1lczxTPl0/OiBTT2JqZWN0PFMsIE4+IH0gPSB7fTtcbiAgY2FjaGU6IENhY2hlO1xuICBfY2FsbE9wdGlvbnM6IE9wdGlvbmFsPHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB9PjtcbiAgX21heFJlcXVlc3Q6IG51bWJlcjtcbiAgX2xvZ2dlcjogTG9nZ2VyO1xuICBfbG9nTGV2ZWw6IE9wdGlvbmFsPExvZ0xldmVsQ29uZmlnPjtcbiAgX3RyYW5zcG9ydDogVHJhbnNwb3J0O1xuICBfc2Vzc2lvblR5cGU6IE9wdGlvbmFsPCdzb2FwJyB8ICdvYXV0aDInPjtcbiAgX3JlZnJlc2hEZWxlZ2F0ZTogT3B0aW9uYWw8U2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZTxTPj47XG5cbiAgLy8gZGVzY3JpYmU6IChuYW1lOiBzdHJpbmcpID0+IFByb21pc2U8RGVzY3JpYmVTT2JqZWN0UmVzdWx0PjtcbiAgZGVzY3JpYmUkOiBDYWNoZWRGdW5jdGlvbjwobmFtZTogc3RyaW5nKSA9PiBQcm9taXNlPERlc2NyaWJlU09iamVjdFJlc3VsdD4+O1xuICBkZXNjcmliZSQkOiBDYWNoZWRGdW5jdGlvbjwobmFtZTogc3RyaW5nKSA9PiBEZXNjcmliZVNPYmplY3RSZXN1bHQ+O1xuICBkZXNjcmliZVNPYmplY3Q6IChuYW1lOiBzdHJpbmcpID0+IFByb21pc2U8RGVzY3JpYmVTT2JqZWN0UmVzdWx0PjtcbiAgZGVzY3JpYmVTT2JqZWN0JDogQ2FjaGVkRnVuY3Rpb248XG4gICAgKG5hbWU6IHN0cmluZykgPT4gUHJvbWlzZTxEZXNjcmliZVNPYmplY3RSZXN1bHQ+XG4gID47XG4gIGRlc2NyaWJlU09iamVjdCQkOiBDYWNoZWRGdW5jdGlvbjwobmFtZTogc3RyaW5nKSA9PiBEZXNjcmliZVNPYmplY3RSZXN1bHQ+O1xuICAvLyBkZXNjcmliZUdsb2JhbDogKCkgPT4gUHJvbWlzZTxEZXNjcmliZUdsb2JhbFJlc3VsdD47XG4gIGRlc2NyaWJlR2xvYmFsJDogQ2FjaGVkRnVuY3Rpb248KCkgPT4gUHJvbWlzZTxEZXNjcmliZUdsb2JhbFJlc3VsdD4+O1xuICBkZXNjcmliZUdsb2JhbCQkOiBDYWNoZWRGdW5jdGlvbjwoKSA9PiBEZXNjcmliZUdsb2JhbFJlc3VsdD47XG5cbiAgLy8gQVBJIGxpYnMgYXJlIG5vdCBpbnN0YW50aWF0ZWQgaGVyZSBzbyB0aGF0IGNvcmUgbW9kdWxlIHRvIHJlbWFpbiB3aXRob3V0IGRlcGVuZGVuY2llcyB0byB0aGVtXG4gIC8vIEl0IGlzIHJlc3BvbnNpYmxlIGZvciBkZXZlbG9wZXJzIHRvIGltcG9ydCBhcGkgbGlicyBleHBsaWNpdGx5IGlmIHRoZXkgYXJlIHVzaW5nICdqc2ZvcmNlL2NvcmUnIGluc3RlYWQgb2YgJ2pzZm9yY2UnLlxuICBnZXQgYW5hbHl0aWNzKCk6IEFuYWx5dGljczxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignYW5hbHl0aWNzJyk7XG4gIH1cblxuICBnZXQgYXBleCgpOiBBcGV4PFM+IHtcbiAgICByZXR1cm4gcmFpc2VOb01vZHVsZUVycm9yKCdhcGV4Jyk7XG4gIH1cblxuICBnZXQgYnVsaygpOiBCdWxrPFM+IHtcbiAgICByZXR1cm4gcmFpc2VOb01vZHVsZUVycm9yKCdidWxrJyk7XG4gIH1cblxuICBnZXQgYnVsazIoKTogQnVsa1YyPFM+IHtcbiAgICByZXR1cm4gcmFpc2VOb01vZHVsZUVycm9yKCdidWxrMicpO1xuICB9XG5cbiAgZ2V0IGNoYXR0ZXIoKTogQ2hhdHRlcjxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignY2hhdHRlcicpO1xuICB9XG5cbiAgZ2V0IG1ldGFkYXRhKCk6IE1ldGFkYXRhPFM+IHtcbiAgICByZXR1cm4gcmFpc2VOb01vZHVsZUVycm9yKCdtZXRhZGF0YScpO1xuICB9XG5cbiAgZ2V0IHNvYXAoKTogU29hcEFwaTxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignc29hcCcpO1xuICB9XG5cbiAgZ2V0IHN0cmVhbWluZygpOiBTdHJlYW1pbmc8Uz4ge1xuICAgIHJldHVybiByYWlzZU5vTW9kdWxlRXJyb3IoJ3N0cmVhbWluZycpO1xuICB9XG5cbiAgZ2V0IHRvb2xpbmcoKTogVG9vbGluZzxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcigndG9vbGluZycpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihjb25maWc6IENvbm5lY3Rpb25Db25maWc8Uz4gPSB7fSkge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3Qge1xuICAgICAgbG9naW5VcmwsXG4gICAgICBpbnN0YW5jZVVybCxcbiAgICAgIHZlcnNpb24sXG4gICAgICBvYXV0aDIsXG4gICAgICBtYXhSZXF1ZXN0LFxuICAgICAgbG9nTGV2ZWwsXG4gICAgICBwcm94eVVybCxcbiAgICAgIGh0dHBQcm94eSxcbiAgICB9ID0gY29uZmlnO1xuICAgIHRoaXMubG9naW5VcmwgPSBsb2dpblVybCB8fCBkZWZhdWx0Q29ubmVjdGlvbkNvbmZpZy5sb2dpblVybDtcbiAgICB0aGlzLmluc3RhbmNlVXJsID0gaW5zdGFuY2VVcmwgfHwgZGVmYXVsdENvbm5lY3Rpb25Db25maWcuaW5zdGFuY2VVcmw7XG4gICAgdGhpcy52ZXJzaW9uID0gdmVyc2lvbiB8fCBkZWZhdWx0Q29ubmVjdGlvbkNvbmZpZy52ZXJzaW9uO1xuICAgIHRoaXMub2F1dGgyID1cbiAgICAgIG9hdXRoMiBpbnN0YW5jZW9mIE9BdXRoMlxuICAgICAgICA/IG9hdXRoMlxuICAgICAgICA6IG5ldyBPQXV0aDIoe1xuICAgICAgICAgICAgbG9naW5Vcmw6IHRoaXMubG9naW5VcmwsXG4gICAgICAgICAgICBwcm94eVVybCxcbiAgICAgICAgICAgIGh0dHBQcm94eSxcbiAgICAgICAgICAgIC4uLm9hdXRoMixcbiAgICAgICAgICB9KTtcbiAgICBsZXQgcmVmcmVzaEZuID0gY29uZmlnLnJlZnJlc2hGbjtcbiAgICBpZiAoIXJlZnJlc2hGbiAmJiB0aGlzLm9hdXRoMi5jbGllbnRJZCkge1xuICAgICAgcmVmcmVzaEZuID0gb2F1dGhSZWZyZXNoRm47XG4gICAgfVxuICAgIGlmIChyZWZyZXNoRm4pIHtcbiAgICAgIHRoaXMuX3JlZnJlc2hEZWxlZ2F0ZSA9IG5ldyBTZXNzaW9uUmVmcmVzaERlbGVnYXRlKHRoaXMsIHJlZnJlc2hGbik7XG4gICAgfVxuICAgIHRoaXMuX21heFJlcXVlc3QgPSBtYXhSZXF1ZXN0IHx8IGRlZmF1bHRDb25uZWN0aW9uQ29uZmlnLm1heFJlcXVlc3Q7XG4gICAgdGhpcy5fbG9nZ2VyID0gbG9nTGV2ZWxcbiAgICAgID8gQ29ubmVjdGlvbi5fbG9nZ2VyLmNyZWF0ZUluc3RhbmNlKGxvZ0xldmVsKVxuICAgICAgOiBDb25uZWN0aW9uLl9sb2dnZXI7XG4gICAgdGhpcy5fbG9nTGV2ZWwgPSBsb2dMZXZlbDtcbiAgICB0aGlzLl90cmFuc3BvcnQgPSBwcm94eVVybFxuICAgICAgPyBuZXcgWGRQcm94eVRyYW5zcG9ydChwcm94eVVybClcbiAgICAgIDogaHR0cFByb3h5XG4gICAgICA/IG5ldyBIdHRwUHJveHlUcmFuc3BvcnQoaHR0cFByb3h5KVxuICAgICAgOiBuZXcgVHJhbnNwb3J0KCk7XG4gICAgdGhpcy5fY2FsbE9wdGlvbnMgPSBjb25maWcuY2FsbE9wdGlvbnM7XG4gICAgdGhpcy5jYWNoZSA9IG5ldyBDYWNoZSgpO1xuICAgIGNvbnN0IGRlc2NyaWJlQ2FjaGVLZXkgPSAodHlwZT86IHN0cmluZykgPT5cbiAgICAgIHR5cGUgPyBgZGVzY3JpYmUuJHt0eXBlfWAgOiAnZGVzY3JpYmUnO1xuICAgIGNvbnN0IGRlc2NyaWJlID0gQ29ubmVjdGlvbi5wcm90b3R5cGUuZGVzY3JpYmU7XG4gICAgdGhpcy5kZXNjcmliZSA9IHRoaXMuY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oZGVzY3JpYmUsIHRoaXMsIHtcbiAgICAgIGtleTogZGVzY3JpYmVDYWNoZUtleSxcbiAgICAgIHN0cmF0ZWd5OiAnTk9DQUNIRScsXG4gICAgfSk7XG4gICAgdGhpcy5kZXNjcmliZSQgPSB0aGlzLmNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKGRlc2NyaWJlLCB0aGlzLCB7XG4gICAgICBrZXk6IGRlc2NyaWJlQ2FjaGVLZXksXG4gICAgICBzdHJhdGVneTogJ0hJVCcsXG4gICAgfSk7XG4gICAgdGhpcy5kZXNjcmliZSQkID0gdGhpcy5jYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihkZXNjcmliZSwgdGhpcywge1xuICAgICAga2V5OiBkZXNjcmliZUNhY2hlS2V5LFxuICAgICAgc3RyYXRlZ3k6ICdJTU1FRElBVEUnLFxuICAgIH0pIGFzIGFueTtcbiAgICB0aGlzLmRlc2NyaWJlU09iamVjdCA9IHRoaXMuZGVzY3JpYmU7XG4gICAgdGhpcy5kZXNjcmliZVNPYmplY3QkID0gdGhpcy5kZXNjcmliZSQ7XG4gICAgdGhpcy5kZXNjcmliZVNPYmplY3QkJCA9IHRoaXMuZGVzY3JpYmUkJDtcbiAgICBjb25zdCBkZXNjcmliZUdsb2JhbCA9IENvbm5lY3Rpb24ucHJvdG90eXBlLmRlc2NyaWJlR2xvYmFsO1xuICAgIHRoaXMuZGVzY3JpYmVHbG9iYWwgPSB0aGlzLmNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKFxuICAgICAgZGVzY3JpYmVHbG9iYWwsXG4gICAgICB0aGlzLFxuICAgICAgeyBrZXk6ICdkZXNjcmliZUdsb2JhbCcsIHN0cmF0ZWd5OiAnTk9DQUNIRScgfSxcbiAgICApO1xuICAgIHRoaXMuZGVzY3JpYmVHbG9iYWwkID0gdGhpcy5jYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihcbiAgICAgIGRlc2NyaWJlR2xvYmFsLFxuICAgICAgdGhpcyxcbiAgICAgIHsga2V5OiAnZGVzY3JpYmVHbG9iYWwnLCBzdHJhdGVneTogJ0hJVCcgfSxcbiAgICApO1xuICAgIHRoaXMuZGVzY3JpYmVHbG9iYWwkJCA9IHRoaXMuY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oXG4gICAgICBkZXNjcmliZUdsb2JhbCxcbiAgICAgIHRoaXMsXG4gICAgICB7IGtleTogJ2Rlc2NyaWJlR2xvYmFsJywgc3RyYXRlZ3k6ICdJTU1FRElBVEUnIH0sXG4gICAgKSBhcyBhbnk7XG4gICAgY29uc3Qge1xuICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICByZWZyZXNoVG9rZW4sXG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBzZXJ2ZXJVcmwsXG4gICAgICBzaWduZWRSZXF1ZXN0LFxuICAgIH0gPSBjb25maWc7XG4gICAgdGhpcy5fZXN0YWJsaXNoKHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuLFxuICAgICAgaW5zdGFuY2VVcmwsXG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBzZXJ2ZXJVcmwsXG4gICAgICBzaWduZWRSZXF1ZXN0LFxuICAgIH0pO1xuXG4gICAganNmb3JjZS5lbWl0KCdjb25uZWN0aW9uOm5ldycsIHRoaXMpO1xuICB9XG5cbiAgLyogQHByaXZhdGUgKi9cbiAgX2VzdGFibGlzaChvcHRpb25zOiBDb25uZWN0aW9uRXN0YWJsaXNoT3B0aW9ucykge1xuICAgIGNvbnN0IHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuLFxuICAgICAgaW5zdGFuY2VVcmwsXG4gICAgICBzZXNzaW9uSWQsXG4gICAgICBzZXJ2ZXJVcmwsXG4gICAgICBzaWduZWRSZXF1ZXN0LFxuICAgICAgdXNlckluZm8sXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgdGhpcy5pbnN0YW5jZVVybCA9IHNlcnZlclVybFxuICAgICAgPyBzZXJ2ZXJVcmwuc3BsaXQoJy8nKS5zbGljZSgwLCAzKS5qb2luKCcvJylcbiAgICAgIDogaW5zdGFuY2VVcmwgfHwgdGhpcy5pbnN0YW5jZVVybDtcbiAgICB0aGlzLmFjY2Vzc1Rva2VuID0gc2Vzc2lvbklkIHx8IGFjY2Vzc1Rva2VuIHx8IHRoaXMuYWNjZXNzVG9rZW47XG4gICAgdGhpcy5yZWZyZXNoVG9rZW4gPSByZWZyZXNoVG9rZW4gfHwgdGhpcy5yZWZyZXNoVG9rZW47XG4gICAgaWYgKHRoaXMucmVmcmVzaFRva2VuICYmICF0aGlzLl9yZWZyZXNoRGVsZWdhdGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1JlZnJlc2ggdG9rZW4gaXMgc3BlY2lmaWVkIHdpdGhvdXQgb2F1dGgyIGNsaWVudCBpbmZvcm1hdGlvbiBvciByZWZyZXNoIGZ1bmN0aW9uJyxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IHNpZ25lZFJlcXVlc3RPYmplY3QgPVxuICAgICAgc2lnbmVkUmVxdWVzdCAmJiBwYXJzZVNpZ25lZFJlcXVlc3Qoc2lnbmVkUmVxdWVzdCk7XG4gICAgaWYgKHNpZ25lZFJlcXVlc3RPYmplY3QpIHtcbiAgICAgIHRoaXMuYWNjZXNzVG9rZW4gPSBzaWduZWRSZXF1ZXN0T2JqZWN0LmNsaWVudC5vYXV0aFRva2VuO1xuICAgICAgaWYgKENhbnZhc1RyYW5zcG9ydC5zdXBwb3J0ZWQpIHtcbiAgICAgICAgdGhpcy5fdHJhbnNwb3J0ID0gbmV3IENhbnZhc1RyYW5zcG9ydChzaWduZWRSZXF1ZXN0T2JqZWN0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy51c2VySW5mbyA9IHVzZXJJbmZvIHx8IHRoaXMudXNlckluZm87XG4gICAgdGhpcy5fc2Vzc2lvblR5cGUgPSBzZXNzaW9uSWQgPyAnc29hcCcgOiAnb2F1dGgyJztcbiAgICB0aGlzLl9yZXNldEluc3RhbmNlKCk7XG4gIH1cblxuICAvKiBAcHJpdmVhdGUgKi9cbiAgX2NsZWFyU2Vzc2lvbigpIHtcbiAgICB0aGlzLmFjY2Vzc1Rva2VuID0gbnVsbDtcbiAgICB0aGlzLnJlZnJlc2hUb2tlbiA9IG51bGw7XG4gICAgdGhpcy5pbnN0YW5jZVVybCA9IGRlZmF1bHRDb25uZWN0aW9uQ29uZmlnLmluc3RhbmNlVXJsO1xuICAgIHRoaXMudXNlckluZm8gPSBudWxsO1xuICAgIHRoaXMuX3Nlc3Npb25UeXBlID0gbnVsbDtcbiAgfVxuXG4gIC8qIEBwcml2ZWF0ZSAqL1xuICBfcmVzZXRJbnN0YW5jZSgpIHtcbiAgICB0aGlzLmxpbWl0SW5mbyA9IHt9O1xuICAgIHRoaXMuc29iamVjdHMgPSB7fTtcbiAgICAvLyBUT0RPIGltcGwgY2FjaGVcbiAgICB0aGlzLmNhY2hlLmNsZWFyKCk7XG4gICAgdGhpcy5jYWNoZS5nZXQoJ2Rlc2NyaWJlR2xvYmFsJykucmVtb3ZlQWxsTGlzdGVuZXJzKCd2YWx1ZScpO1xuICAgIHRoaXMuY2FjaGUuZ2V0KCdkZXNjcmliZUdsb2JhbCcpLm9uKCd2YWx1ZScsICh7IHJlc3VsdCB9KSA9PiB7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIGZvciAoY29uc3Qgc28gb2YgcmVzdWx0LnNvYmplY3RzKSB7XG4gICAgICAgICAgdGhpcy5zb2JqZWN0KHNvLm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgLypcbiAgICBpZiAodGhpcy50b29saW5nKSB7XG4gICAgICB0aGlzLnRvb2xpbmcuX3Jlc2V0SW5zdGFuY2UoKTtcbiAgICB9XG4gICAgKi9cbiAgfVxuXG4gIC8qKlxuICAgKiBBdXRob3JpemUgKHVzaW5nIG9hdXRoMiB3ZWIgc2VydmVyIGZsb3cpXG4gICAqL1xuICBhc3luYyBhdXRob3JpemUoXG4gICAgY29kZTogc3RyaW5nLFxuICAgIHBhcmFtczogeyBbbmFtZTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fSxcbiAgKTogUHJvbWlzZTxVc2VySW5mbz4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMub2F1dGgyLnJlcXVlc3RUb2tlbihjb2RlLCBwYXJhbXMpO1xuICAgIGNvbnN0IHVzZXJJbmZvID0gcGFyc2VJZFVybChyZXMuaWQpO1xuICAgIHRoaXMuX2VzdGFibGlzaCh7XG4gICAgICBpbnN0YW5jZVVybDogcmVzLmluc3RhbmNlX3VybCxcbiAgICAgIGFjY2Vzc1Rva2VuOiByZXMuYWNjZXNzX3Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiByZXMucmVmcmVzaF90b2tlbixcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGA8bG9naW4+IGNvbXBsZXRlZC4gdXNlciBpZCA9ICR7dXNlckluZm8uaWR9LCBvcmcgaWQgPSAke3VzZXJJbmZvLm9yZ2FuaXphdGlvbklkfWAsXG4gICAgKTtcbiAgICByZXR1cm4gdXNlckluZm87XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIGxvZ2luKHVzZXJuYW1lOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPFVzZXJJbmZvPiB7XG4gICAgdGhpcy5fcmVmcmVzaERlbGVnYXRlID0gbmV3IFNlc3Npb25SZWZyZXNoRGVsZWdhdGUoXG4gICAgICB0aGlzLFxuICAgICAgY3JlYXRlVXNlcm5hbWVQYXNzd29yZFJlZnJlc2hGbih1c2VybmFtZSwgcGFzc3dvcmQpLFxuICAgICk7XG4gICAgaWYgKHRoaXMub2F1dGgyICYmIHRoaXMub2F1dGgyLmNsaWVudElkICYmIHRoaXMub2F1dGgyLmNsaWVudFNlY3JldCkge1xuICAgICAgcmV0dXJuIHRoaXMubG9naW5CeU9BdXRoMih1c2VybmFtZSwgcGFzc3dvcmQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2dpbkJ5U29hcCh1c2VybmFtZSwgcGFzc3dvcmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZ2luIGJ5IE9BdXRoMiB1c2VybmFtZSAmIHBhc3N3b3JkIGZsb3dcbiAgICovXG4gIGFzeW5jIGxvZ2luQnlPQXV0aDIodXNlcm5hbWU6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8VXNlckluZm8+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm9hdXRoMi5hdXRoZW50aWNhdGUodXNlcm5hbWUsIHBhc3N3b3JkKTtcbiAgICBjb25zdCB1c2VySW5mbyA9IHBhcnNlSWRVcmwocmVzLmlkKTtcbiAgICB0aGlzLl9lc3RhYmxpc2goe1xuICAgICAgaW5zdGFuY2VVcmw6IHJlcy5pbnN0YW5jZV91cmwsXG4gICAgICBhY2Nlc3NUb2tlbjogcmVzLmFjY2Vzc190b2tlbixcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5pbmZvKFxuICAgICAgYDxsb2dpbj4gY29tcGxldGVkLiB1c2VyIGlkID0gJHt1c2VySW5mby5pZH0sIG9yZyBpZCA9ICR7dXNlckluZm8ub3JnYW5pemF0aW9uSWR9YCxcbiAgICApO1xuICAgIHJldHVybiB1c2VySW5mbztcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgbG9naW5CeVNvYXAodXNlcm5hbWU6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8VXNlckluZm8+IHtcbiAgICBpZiAoIXVzZXJuYW1lIHx8ICFwYXNzd29yZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignbm8gdXNlcm5hbWUgcGFzc3dvcmQgZ2l2ZW4nKSk7XG4gICAgfVxuICAgIGNvbnN0IGJvZHkgPSBbXG4gICAgICAnPHNlOkVudmVsb3BlIHhtbG5zOnNlPVwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvc29hcC9lbnZlbG9wZS9cIj4nLFxuICAgICAgJzxzZTpIZWFkZXIvPicsXG4gICAgICAnPHNlOkJvZHk+JyxcbiAgICAgICc8bG9naW4geG1sbnM9XCJ1cm46cGFydG5lci5zb2FwLnNmb3JjZS5jb21cIj4nLFxuICAgICAgYDx1c2VybmFtZT4ke2VzYyh1c2VybmFtZSl9PC91c2VybmFtZT5gLFxuICAgICAgYDxwYXNzd29yZD4ke2VzYyhwYXNzd29yZCl9PC9wYXNzd29yZD5gLFxuICAgICAgJzwvbG9naW4+JyxcbiAgICAgICc8L3NlOkJvZHk+JyxcbiAgICAgICc8L3NlOkVudmVsb3BlPicsXG4gICAgXS5qb2luKCcnKTtcblxuICAgIGNvbnN0IHNvYXBMb2dpbkVuZHBvaW50ID0gW1xuICAgICAgdGhpcy5sb2dpblVybCxcbiAgICAgICdzZXJ2aWNlcy9Tb2FwL3UnLFxuICAgICAgdGhpcy52ZXJzaW9uLFxuICAgIF0uam9pbignLycpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fdHJhbnNwb3J0Lmh0dHBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsOiBzb2FwTG9naW5FbmRwb2ludCxcbiAgICAgIGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnLFxuICAgICAgICBTT0FQQWN0aW9uOiAnXCJcIicsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGxldCBtO1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgbSA9IHJlc3BvbnNlLmJvZHkubWF0Y2goLzxmYXVsdHN0cmluZz4oW148XSspPFxcL2ZhdWx0c3RyaW5nPi8pO1xuICAgICAgY29uc3QgZmF1bHRzdHJpbmcgPSBtICYmIG1bMV07XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZmF1bHRzdHJpbmcgfHwgcmVzcG9uc2UuYm9keSk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhgU09BUCByZXNwb25zZSA9ICR7cmVzcG9uc2UuYm9keX1gKTtcbiAgICBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPHNlcnZlclVybD4oW148XSspPFxcL3NlcnZlclVybD4vKTtcbiAgICBjb25zdCBzZXJ2ZXJVcmwgPSBtICYmIG1bMV07XG4gICAgbSA9IHJlc3BvbnNlLmJvZHkubWF0Y2goLzxzZXNzaW9uSWQ+KFtePF0rKTxcXC9zZXNzaW9uSWQ+Lyk7XG4gICAgY29uc3Qgc2Vzc2lvbklkID0gbSAmJiBtWzFdO1xuICAgIG0gPSByZXNwb25zZS5ib2R5Lm1hdGNoKC88dXNlcklkPihbXjxdKyk8XFwvdXNlcklkPi8pO1xuICAgIGNvbnN0IHVzZXJJZCA9IG0gJiYgbVsxXTtcbiAgICBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPG9yZ2FuaXphdGlvbklkPihbXjxdKyk8XFwvb3JnYW5pemF0aW9uSWQ+Lyk7XG4gICAgY29uc3Qgb3JnYW5pemF0aW9uSWQgPSBtICYmIG1bMV07XG4gICAgaWYgKCFzZXJ2ZXJVcmwgfHwgIXNlc3Npb25JZCB8fCAhdXNlcklkIHx8ICFvcmdhbml6YXRpb25JZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnY291bGQgbm90IGV4dHJhY3Qgc2Vzc2lvbiBpbmZvcm1hdGlvbiBmcm9tIGxvZ2luIHJlc3BvbnNlJyxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IGlkVXJsID0gW3RoaXMubG9naW5VcmwsICdpZCcsIG9yZ2FuaXphdGlvbklkLCB1c2VySWRdLmpvaW4oJy8nKTtcbiAgICBjb25zdCB1c2VySW5mbyA9IHsgaWQ6IHVzZXJJZCwgb3JnYW5pemF0aW9uSWQsIHVybDogaWRVcmwgfTtcbiAgICB0aGlzLl9lc3RhYmxpc2goe1xuICAgICAgc2VydmVyVXJsOiBzZXJ2ZXJVcmwuc3BsaXQoJy8nKS5zbGljZSgwLCAzKS5qb2luKCcvJyksXG4gICAgICBzZXNzaW9uSWQsXG4gICAgICB1c2VySW5mbyxcbiAgICB9KTtcbiAgICB0aGlzLl9sb2dnZXIuaW5mbyhcbiAgICAgIGA8bG9naW4+IGNvbXBsZXRlZC4gdXNlciBpZCA9ICR7dXNlcklkfSwgb3JnIGlkID0gJHtvcmdhbml6YXRpb25JZH1gLFxuICAgICk7XG4gICAgcmV0dXJuIHVzZXJJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZ291dCB0aGUgY3VycmVudCBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBsb2dvdXQocmV2b2tlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuX3JlZnJlc2hEZWxlZ2F0ZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAodGhpcy5fc2Vzc2lvblR5cGUgPT09ICdvYXV0aDInKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2dvdXRCeU9BdXRoMihyZXZva2UpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2dvdXRCeVNvYXAocmV2b2tlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dvdXQgdGhlIGN1cnJlbnQgc2Vzc2lvbiBieSByZXZva2luZyBhY2Nlc3MgdG9rZW4gdmlhIE9BdXRoMiBzZXNzaW9uIHJldm9rZVxuICAgKi9cbiAgYXN5bmMgbG9nb3V0QnlPQXV0aDIocmV2b2tlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRva2VuID0gcmV2b2tlID8gdGhpcy5yZWZyZXNoVG9rZW4gOiB0aGlzLmFjY2Vzc1Rva2VuO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgYXdhaXQgdGhpcy5vYXV0aDIucmV2b2tlVG9rZW4odG9rZW4pO1xuICAgIH1cbiAgICAvLyBEZXN0cm95IHRoZSBzZXNzaW9uIGJvdW5kIHRvIHRoaXMgY29ubmVjdGlvblxuICAgIHRoaXMuX2NsZWFyU2Vzc2lvbigpO1xuICAgIHRoaXMuX3Jlc2V0SW5zdGFuY2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dvdXQgdGhlIHNlc3Npb24gYnkgdXNpbmcgU09BUCB3ZWIgc2VydmljZSBBUElcbiAgICovXG4gIGFzeW5jIGxvZ291dEJ5U29hcChyZXZva2U/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYm9keSA9IFtcbiAgICAgICc8c2U6RW52ZWxvcGUgeG1sbnM6c2U9XCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy9zb2FwL2VudmVsb3BlL1wiPicsXG4gICAgICAnPHNlOkhlYWRlcj4nLFxuICAgICAgJzxTZXNzaW9uSGVhZGVyIHhtbG5zPVwidXJuOnBhcnRuZXIuc29hcC5zZm9yY2UuY29tXCI+JyxcbiAgICAgIGA8c2Vzc2lvbklkPiR7ZXNjKFxuICAgICAgICByZXZva2UgPyB0aGlzLnJlZnJlc2hUb2tlbiA6IHRoaXMuYWNjZXNzVG9rZW4sXG4gICAgICApfTwvc2Vzc2lvbklkPmAsXG4gICAgICAnPC9TZXNzaW9uSGVhZGVyPicsXG4gICAgICAnPC9zZTpIZWFkZXI+JyxcbiAgICAgICc8c2U6Qm9keT4nLFxuICAgICAgJzxsb2dvdXQgeG1sbnM9XCJ1cm46cGFydG5lci5zb2FwLnNmb3JjZS5jb21cIi8+JyxcbiAgICAgICc8L3NlOkJvZHk+JyxcbiAgICAgICc8L3NlOkVudmVsb3BlPicsXG4gICAgXS5qb2luKCcnKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX3RyYW5zcG9ydC5odHRwUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHVybDogW3RoaXMuaW5zdGFuY2VVcmwsICdzZXJ2aWNlcy9Tb2FwL3UnLCB0aGlzLnZlcnNpb25dLmpvaW4oJy8nKSxcbiAgICAgIGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnLFxuICAgICAgICBTT0FQQWN0aW9uOiAnXCJcIicsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGBTT0FQIHN0YXR1c0NvZGUgPSAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9LCByZXNwb25zZSA9ICR7cmVzcG9uc2UuYm9keX1gLFxuICAgICk7XG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPj0gNDAwKSB7XG4gICAgICBjb25zdCBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPGZhdWx0c3RyaW5nPihbXjxdKyk8XFwvZmF1bHRzdHJpbmc+Lyk7XG4gICAgICBjb25zdCBmYXVsdHN0cmluZyA9IG0gJiYgbVsxXTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihmYXVsdHN0cmluZyB8fCByZXNwb25zZS5ib2R5KTtcbiAgICB9XG4gICAgLy8gRGVzdHJveSB0aGUgc2Vzc2lvbiBib3VuZCB0byB0aGlzIGNvbm5lY3Rpb25cbiAgICB0aGlzLl9jbGVhclNlc3Npb24oKTtcbiAgICB0aGlzLl9yZXNldEluc3RhbmNlKCk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBSRVNUIEFQSSByZXF1ZXN0IHdpdGggZ2l2ZW4gSFRUUCByZXF1ZXN0IGluZm8sIHdpdGggY29ubmVjdGVkIHNlc3Npb24gaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEVuZHBvaW50IFVSTCBjYW4gYmUgYWJzb2x1dGUgVVJMICgnaHR0cHM6Ly9uYTEuc2FsZXNmb3JjZS5jb20vc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCByZWxhdGl2ZSBwYXRoIGZyb20gcm9vdCAoJy9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIG9yIHJlbGF0aXZlIHBhdGggZnJvbSB2ZXJzaW9uIHJvb3QgKCcvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpLlxuICAgKi9cbiAgcmVxdWVzdDxSID0gdW5rbm93bj4oXG4gICAgcmVxdWVzdDogc3RyaW5nIHwgSHR0cFJlcXVlc3QsXG4gICAgb3B0aW9uczogT2JqZWN0ID0ge30sXG4gICk6IFN0cmVhbVByb21pc2U8Uj4ge1xuICAgIC8vIGlmIHJlcXVlc3QgaXMgc2ltcGxlIHN0cmluZywgcmVnYXJkIGl0IGFzIHVybCBpbiBHRVQgbWV0aG9kXG4gICAgbGV0IHJlcXVlc3RfOiBIdHRwUmVxdWVzdCA9XG4gICAgICB0eXBlb2YgcmVxdWVzdCA9PT0gJ3N0cmluZycgPyB7IG1ldGhvZDogJ0dFVCcsIHVybDogcmVxdWVzdCB9IDogcmVxdWVzdDtcbiAgICAvLyBpZiB1cmwgaXMgZ2l2ZW4gaW4gcmVsYXRpdmUgcGF0aCwgcHJlcGVuZCBiYXNlIHVybCBvciBpbnN0YW5jZSB1cmwgYmVmb3JlLlxuICAgIHJlcXVlc3RfID0ge1xuICAgICAgLi4ucmVxdWVzdF8sXG4gICAgICB1cmw6IHRoaXMuX25vcm1hbGl6ZVVybChyZXF1ZXN0Xy51cmwpLFxuICAgIH07XG4gICAgY29uc3QgaHR0cEFwaSA9IG5ldyBIdHRwQXBpKHRoaXMsIG9wdGlvbnMpO1xuICAgIC8vIGxvZyBhcGkgdXNhZ2UgYW5kIGl0cyBxdW90YVxuICAgIGh0dHBBcGkub24oJ3Jlc3BvbnNlJywgKHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChyZXNwb25zZS5oZWFkZXJzICYmIHJlc3BvbnNlLmhlYWRlcnNbJ3Nmb3JjZS1saW1pdC1pbmZvJ10pIHtcbiAgICAgICAgY29uc3QgYXBpVXNhZ2UgPSByZXNwb25zZS5oZWFkZXJzWydzZm9yY2UtbGltaXQtaW5mbyddLm1hdGNoKFxuICAgICAgICAgIC9hcGktdXNhZ2U9KFxcZCspXFwvKFxcZCspLyxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGFwaVVzYWdlKSB7XG4gICAgICAgICAgdGhpcy5saW1pdEluZm8gPSB7XG4gICAgICAgICAgICBhcGlVc2FnZToge1xuICAgICAgICAgICAgICB1c2VkOiBwYXJzZUludChhcGlVc2FnZVsxXSwgMTApLFxuICAgICAgICAgICAgICBsaW1pdDogcGFyc2VJbnQoYXBpVXNhZ2VbMl0sIDEwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBodHRwQXBpLnJlcXVlc3Q8Uj4ocmVxdWVzdF8pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBHRVQgcmVxdWVzdFxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RHZXQ8UiA9IHVua25vd24+KHVybDogc3RyaW5nLCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7IG1ldGhvZDogJ0dFVCcsIHVybCB9O1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8Uj4ocmVxdWVzdCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBIVFRQIFBPU1QgcmVxdWVzdCB3aXRoIEpTT04gYm9keSwgd2l0aCBjb25uZWN0ZWQgc2Vzc2lvbiBpbmZvcm1hdGlvblxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RQb3N0PFIgPSB1bmtub3duPih1cmw6IHN0cmluZywgYm9keTogT2JqZWN0LCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHVybCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFI+KHJlcXVlc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBQVVQgcmVxdWVzdCB3aXRoIEpTT04gYm9keSwgd2l0aCBjb25uZWN0ZWQgc2Vzc2lvbiBpbmZvcm1hdGlvblxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RQdXQ8Uj4odXJsOiBzdHJpbmcsIGJvZHk6IE9iamVjdCwgb3B0aW9ucz86IE9iamVjdCkge1xuICAgIGNvbnN0IHJlcXVlc3Q6IEh0dHBSZXF1ZXN0ID0ge1xuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIHVybCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFI+KHJlcXVlc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBQQVRDSCByZXF1ZXN0IHdpdGggSlNPTiBib2R5XG4gICAqXG4gICAqIEVuZHBvaW50IFVSTCBjYW4gYmUgYWJzb2x1dGUgVVJMICgnaHR0cHM6Ly9uYTEuc2FsZXNmb3JjZS5jb20vc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCByZWxhdGl2ZSBwYXRoIGZyb20gcm9vdCAoJy9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIG9yIHJlbGF0aXZlIHBhdGggZnJvbSB2ZXJzaW9uIHJvb3QgKCcvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpLlxuICAgKi9cbiAgcmVxdWVzdFBhdGNoPFIgPSB1bmtub3duPih1cmw6IHN0cmluZywgYm9keTogT2JqZWN0LCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7XG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxSPihyZXF1ZXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIEhUVFAgREVMRVRFIHJlcXVlc3RcbiAgICpcbiAgICogRW5kcG9pbnQgVVJMIGNhbiBiZSBhYnNvbHV0ZSBVUkwgKCdodHRwczovL25hMS5zYWxlc2ZvcmNlLmNvbS9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIHJlbGF0aXZlIHBhdGggZnJvbSByb290ICgnL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgb3IgcmVsYXRpdmUgcGF0aCBmcm9tIHZlcnNpb24gcm9vdCAoJy9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJykuXG4gICAqL1xuICByZXF1ZXN0RGVsZXRlPFI+KHVybDogc3RyaW5nLCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7IG1ldGhvZDogJ0RFTEVURScsIHVybCB9O1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8Uj4ocmVxdWVzdCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKiovXG4gIF9iYXNlVXJsKCkge1xuICAgIHJldHVybiBbdGhpcy5pbnN0YW5jZVVybCwgJ3NlcnZpY2VzL2RhdGEnLCBgdiR7dGhpcy52ZXJzaW9ufWBdLmpvaW4oJy8nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IHBhdGggdG8gYWJzb2x1dGUgdXJsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbm9ybWFsaXplVXJsKHVybDogc3RyaW5nKSB7XG4gICAgaWYgKHVybFswXSA9PT0gJy8nKSB7XG4gICAgICBpZiAodXJsLmluZGV4T2YodGhpcy5pbnN0YW5jZVVybCArICcvc2VydmljZXMvJykgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICAgIH1cbiAgICAgIGlmICh1cmwuaW5kZXhPZignL3NlcnZpY2VzLycpID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlVXJsICsgdXJsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2Jhc2VVcmwoKSArIHVybDtcbiAgICB9XG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcXVlcnk8VCBleHRlbmRzIFJlY29yZD4oXG4gICAgc29xbDogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPFF1ZXJ5T3B0aW9ucz4sXG4gICk6IFF1ZXJ5PFMsIFNPYmplY3ROYW1lczxTPiwgVCwgJ1F1ZXJ5UmVzdWx0Jz4ge1xuICAgIHJldHVybiBuZXcgUXVlcnk8UywgU09iamVjdE5hbWVzPFM+LCBULCAnUXVlcnlSZXN1bHQnPih0aGlzLCBzb3FsLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIHNlYXJjaCBieSBTT1NMXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzb3NsIC0gU09TTCBzdHJpbmdcbiAgICogQHBhcmFtIHtDYWxsYmFjay48QXJyYXkuPFJlY29yZFJlc3VsdD4+fSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMge1Byb21pc2UuPEFycmF5LjxSZWNvcmRSZXN1bHQ+Pn1cbiAgICovXG4gIHNlYXJjaChzb3NsOiBzdHJpbmcpIHtcbiAgICB2YXIgdXJsID0gdGhpcy5fYmFzZVVybCgpICsgJy9zZWFyY2g/cT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHNvc2wpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8U2VhcmNoUmVzdWx0Pih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBxdWVyeU1vcmUobG9jYXRvcjogc3RyaW5nLCBvcHRpb25zPzogUXVlcnlPcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBRdWVyeTxTLCBTT2JqZWN0TmFtZXM8Uz4sIFJlY29yZCwgJ1F1ZXJ5UmVzdWx0Jz4oXG4gICAgICB0aGlzLFxuICAgICAgeyBsb2NhdG9yIH0sXG4gICAgICBvcHRpb25zLFxuICAgICk7XG4gIH1cblxuICAvKiAqL1xuICBfZW5zdXJlVmVyc2lvbihtYWpvclZlcnNpb246IG51bWJlcikge1xuICAgIGNvbnN0IHZlcnNpb25zID0gdGhpcy52ZXJzaW9uLnNwbGl0KCcuJyk7XG4gICAgcmV0dXJuIHBhcnNlSW50KHZlcnNpb25zWzBdLCAxMCkgPj0gbWFqb3JWZXJzaW9uO1xuICB9XG5cbiAgLyogKi9cbiAgX3N1cHBvcnRzKGZlYXR1cmU6IHN0cmluZykge1xuICAgIHN3aXRjaCAoZmVhdHVyZSkge1xuICAgICAgY2FzZSAnc29iamVjdC1jb2xsZWN0aW9uJzogLy8gc29iamVjdCBjb2xsZWN0aW9uIGlzIGF2YWlsYWJsZSBvbmx5IGluIEFQSSB2ZXIgNDIuMCtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Vuc3VyZVZlcnNpb24oNDIpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBzcGVjaWZpZWQgcmVjb3Jkc1xuICAgKi9cbiAgcmV0cmlldmU8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyxcbiAgICBvcHRpb25zPzogUmV0cmlldmVPcHRpb25zLFxuICApOiBQcm9taXNlPFJlY29yZD47XG4gIHJldHJpZXZlPE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4+KFxuICAgIHR5cGU6IE4sXG4gICAgaWRzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zPzogUmV0cmlldmVPcHRpb25zLFxuICApOiBQcm9taXNlPFJlY29yZFtdPjtcbiAgcmV0cmlldmU8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBSZXRyaWV2ZU9wdGlvbnMsXG4gICk6IFByb21pc2U8UmVjb3JkIHwgUmVjb3JkW10+O1xuICBhc3luYyByZXRyaWV2ZShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBSZXRyaWV2ZU9wdGlvbnMgPSB7fSxcbiAgKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaWRzKVxuICAgICAgPyAvLyBjaGVjayB0aGUgdmVyc2lvbiB3aGV0aGVyIFNPYmplY3QgY29sbGVjdGlvbiBBUEkgaXMgc3VwcG9ydGVkICg0Mi4wKVxuICAgICAgICB0aGlzLl9lbnN1cmVWZXJzaW9uKDQyKVxuICAgICAgICA/IHRoaXMuX3JldHJpZXZlTWFueSh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fcmV0cmlldmVQYXJhbGxlbCh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICA6IHRoaXMuX3JldHJpZXZlU2luZ2xlKHR5cGUsIGlkcywgb3B0aW9ucyk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX3JldHJpZXZlU2luZ2xlKHR5cGU6IHN0cmluZywgaWQ6IHN0cmluZywgb3B0aW9uczogUmV0cmlldmVPcHRpb25zKSB7XG4gICAgaWYgKCFpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHJlY29yZCBJRC4gU3BlY2lmeSB2YWxpZCByZWNvcmQgSUQgdmFsdWUnKTtcbiAgICB9XG4gICAgbGV0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdzb2JqZWN0cycsIHR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgY29uc3QgeyBmaWVsZHMsIGhlYWRlcnMgfSA9IG9wdGlvbnM7XG4gICAgaWYgKGZpZWxkcykge1xuICAgICAgdXJsICs9IGA/ZmllbGRzPSR7ZmllbGRzLmpvaW4oJywnKX1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHsgbWV0aG9kOiAnR0VUJywgdXJsLCBoZWFkZXJzIH0pO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9yZXRyaWV2ZVBhcmFsbGVsKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBpZHM6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFJldHJpZXZlT3B0aW9ucyxcbiAgKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgaWRzLm1hcCgoaWQpID0+XG4gICAgICAgIHRoaXMuX3JldHJpZXZlU2luZ2xlKHR5cGUsIGlkLCBvcHRpb25zKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lIHx8IGVyci5lcnJvckNvZGUgIT09ICdOT1RfRk9VTkQnKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfcmV0cmlldmVNYW55KHR5cGU6IHN0cmluZywgaWRzOiBzdHJpbmdbXSwgb3B0aW9uczogUmV0cmlldmVPcHRpb25zKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ2NvbXBvc2l0ZScsICdzb2JqZWN0cycsIHR5cGVdLmpvaW4oJy8nKTtcbiAgICBjb25zdCBmaWVsZHMgPVxuICAgICAgb3B0aW9ucy5maWVsZHMgfHxcbiAgICAgIChhd2FpdCB0aGlzLmRlc2NyaWJlJCh0eXBlKSkuZmllbGRzLm1hcCgoZmllbGQpID0+IGZpZWxkLm5hbWUpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGlkcywgZmllbGRzIH0pLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHJlY29yZHNcbiAgICovXG4gIGNyZWF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+XG4gID4oXG4gICAgdHlwZTogTixcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIGNyZWF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+XG4gID4odHlwZTogTiwgcmVjb3JkOiBJbnB1dFJlY29yZCwgb3B0aW9ucz86IERtbE9wdGlvbnMpOiBQcm9taXNlPFNhdmVSZXN1bHQ+O1xuICBjcmVhdGU8XG4gICAgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPixcbiAgICBJbnB1dFJlY29yZCBleHRlbmRzIFNPYmplY3RJbnB1dFJlY29yZDxTLCBOPiA9IFNPYmplY3RJbnB1dFJlY29yZDxTLCBOPlxuICA+KFxuICAgIHR5cGU6IE4sXG4gICAgcmVjb3JkczogSW5wdXRSZWNvcmQgfCBJbnB1dFJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIHJlY29yZHNcbiAgICogQHBhcmFtIG9wdGlvbnNcbiAgICovXG4gIGFzeW5jIGNyZWF0ZShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgcmVjb3JkczogUmVjb3JkIHwgUmVjb3JkW10sXG4gICAgb3B0aW9uczogRG1sT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBjb25zdCByZXQgPSBBcnJheS5pc0FycmF5KHJlY29yZHMpXG4gICAgICA/IC8vIGNoZWNrIHRoZSB2ZXJzaW9uIHdoZXRoZXIgU09iamVjdCBjb2xsZWN0aW9uIEFQSSBpcyBzdXBwb3J0ZWQgKDQyLjApXG4gICAgICAgIHRoaXMuX2Vuc3VyZVZlcnNpb24oNDIpXG4gICAgICAgID8gYXdhaXQgdGhpcy5fY3JlYXRlTWFueSh0eXBlLCByZWNvcmRzLCBvcHRpb25zKVxuICAgICAgICA6IGF3YWl0IHRoaXMuX2NyZWF0ZVBhcmFsbGVsKHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpXG4gICAgICA6IGF3YWl0IHRoaXMuX2NyZWF0ZVNpbmdsZSh0eXBlLCByZWNvcmRzLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9jcmVhdGVTaW5nbGUodHlwZTogc3RyaW5nLCByZWNvcmQ6IFJlY29yZCwgb3B0aW9uczogRG1sT3B0aW9ucykge1xuICAgIGNvbnN0IHsgSWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICBjb25zdCBzb2JqZWN0VHlwZSA9IHR5cGUgfHwgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy50eXBlKSB8fCBydHlwZTtcbiAgICBpZiAoIXNvYmplY3RUeXBlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIFNPYmplY3QgVHlwZSBkZWZpbmVkIGluIHJlY29yZCcpO1xuICAgIH1cbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCBzb2JqZWN0VHlwZV0uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZWMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX2NyZWF0ZVBhcmFsbGVsKHR5cGU6IHN0cmluZywgcmVjb3JkczogUmVjb3JkW10sIG9wdGlvbnM6IERtbE9wdGlvbnMpIHtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVjb3Jkcy5tYXAoKHJlY29yZCkgPT5cbiAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKHR5cGUsIHJlY29yZCwgb3B0aW9ucykuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIC8vIGJlIGF3YXJlIHRoYXQgYWxsT3JOb25lIGluIHBhcmFsbGVsIG1vZGUgd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzXG4gICAgICAgICAgLy8gaXQgb25seSByYWlzZXMgZXJyb3Igd2hlbiBtZXQgYXQgbGVhc3Qgb25lIGZhaWxlZCByZXF1ZXN0LlxuICAgICAgICAgIGlmIChvcHRpb25zLmFsbE9yTm9uZSB8fCAhZXJyLmVycm9yQ29kZSkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdG9TYXZlUmVzdWx0KGVycik7XG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9jcmVhdGVNYW55KFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICByZWNvcmRzOiBSZWNvcmRbXSxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT4ge1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG4gICAgfVxuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX2NyZWF0ZU1hbnkoXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICByZWNvcmRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fY3JlYXRlTWFueShcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHJlY29yZHMuc2xpY2UoTUFYX0RNTF9DT1VOVCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBjb25zdCBfcmVjb3JkcyA9IHJlY29yZHMubWFwKChyZWNvcmQpID0+IHtcbiAgICAgIGNvbnN0IHsgSWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICAgIGNvbnN0IHNvYmplY3RUeXBlID0gdHlwZSB8fCAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnR5cGUpIHx8IHJ0eXBlO1xuICAgICAgaWYgKCFzb2JqZWN0VHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIFNPYmplY3QgVHlwZSBkZWZpbmVkIGluIHJlY29yZCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsgYXR0cmlidXRlczogeyB0eXBlOiBzb2JqZWN0VHlwZSB9LCAuLi5yZWMgfTtcbiAgICB9KTtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnY29tcG9zaXRlJywgJ3NvYmplY3RzJ10uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFsbE9yTm9uZTogb3B0aW9ucy5hbGxPck5vbmUgfHwgZmFsc2UsXG4gICAgICAgIHJlY29yZHM6IF9yZWNvcmRzLFxuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIENvbm5lY3Rpb24jY3JlYXRlKClcbiAgICovXG4gIGluc2VydCA9IHRoaXMuY3JlYXRlO1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgcmVjb3Jkc1xuICAgKi9cbiAgdXBkYXRlPFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgVXBkYXRlUmVjb3JkIGV4dGVuZHMgU09iamVjdFVwZGF0ZVJlY29yZDxTLCBOPiA9IFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFVwZGF0ZVJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIHVwZGF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIFVwZGF0ZVJlY29yZCBleHRlbmRzIFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj4gPSBTT2JqZWN0VXBkYXRlUmVjb3JkPFMsIE4+XG4gID4odHlwZTogTiwgcmVjb3JkOiBVcGRhdGVSZWNvcmQsIG9wdGlvbnM/OiBEbWxPcHRpb25zKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgdXBkYXRlPFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgVXBkYXRlUmVjb3JkIGV4dGVuZHMgU09iamVjdFVwZGF0ZVJlY29yZDxTLCBOPiA9IFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFVwZGF0ZVJlY29yZCB8IFVwZGF0ZVJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIHJlY29yZHNcbiAgICogQHBhcmFtIG9wdGlvbnNcbiAgICovXG4gIHVwZGF0ZTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFJlY29yZCB8IFJlY29yZFtdLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxTYXZlUmVzdWx0IHwgU2F2ZVJlc3VsdFtdPiB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocmVjb3JkcylcbiAgICAgID8gLy8gY2hlY2sgdGhlIHZlcnNpb24gd2hldGhlciBTT2JqZWN0IGNvbGxlY3Rpb24gQVBJIGlzIHN1cHBvcnRlZCAoNDIuMClcbiAgICAgICAgdGhpcy5fZW5zdXJlVmVyc2lvbig0MilcbiAgICAgICAgPyB0aGlzLl91cGRhdGVNYW55KHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fdXBkYXRlUGFyYWxsZWwodHlwZSwgcmVjb3Jkcywgb3B0aW9ucylcbiAgICAgIDogdGhpcy5fdXBkYXRlU2luZ2xlKHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF91cGRhdGVTaW5nbGUoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZDogUmVjb3JkLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHsgSWQ6IGlkLCB0eXBlOiBydHlwZSwgYXR0cmlidXRlcywgLi4ucmVjIH0gPSByZWNvcmQ7XG4gICAgaWYgKCFpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWNvcmQgaWQgaXMgbm90IGZvdW5kIGluIHJlY29yZC4nKTtcbiAgICB9XG4gICAgY29uc3Qgc29iamVjdFR5cGUgPSB0eXBlIHx8IChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMudHlwZSkgfHwgcnR5cGU7XG4gICAgaWYgKCFzb2JqZWN0VHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBTT2JqZWN0IFR5cGUgZGVmaW5lZCBpbiByZWNvcmQnKTtcbiAgICB9XG4gICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgc29iamVjdFR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICB1cmwsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlYyksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbm9Db250ZW50UmVzcG9uc2U6IHsgaWQsIHN1Y2Nlc3M6IHRydWUsIGVycm9yczogW10gfSxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfdXBkYXRlUGFyYWxsZWwodHlwZTogc3RyaW5nLCByZWNvcmRzOiBSZWNvcmRbXSwgb3B0aW9uczogRG1sT3B0aW9ucykge1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IHRoaXMuX21heFJlcXVlc3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhjZWVkZWQgbWF4IGxpbWl0IG9mIGNvbmN1cnJlbnQgY2FsbCcpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICByZWNvcmRzLm1hcCgocmVjb3JkKSA9PlxuICAgICAgICB0aGlzLl91cGRhdGVTaW5nbGUodHlwZSwgcmVjb3JkLCBvcHRpb25zKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgLy8gYmUgYXdhcmUgdGhhdCBhbGxPck5vbmUgaW4gcGFyYWxsZWwgbW9kZSB3aWxsIG5vdCByZXZlcnQgdGhlIG90aGVyIHN1Y2Nlc3NmdWwgcmVxdWVzdHNcbiAgICAgICAgICAvLyBpdCBvbmx5IHJhaXNlcyBlcnJvciB3aGVuIG1ldCBhdCBsZWFzdCBvbmUgZmFpbGVkIHJlcXVlc3QuXG4gICAgICAgICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lIHx8ICFlcnIuZXJyb3JDb2RlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0b1NhdmVSZXN1bHQoZXJyKTtcbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX3VwZGF0ZU1hbnkoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZHM6IFJlY29yZFtdLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPiB7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX3VwZGF0ZU1hbnkoXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICByZWNvcmRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fdXBkYXRlTWFueShcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHJlY29yZHMuc2xpY2UoTUFYX0RNTF9DT1VOVCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBjb25zdCBfcmVjb3JkcyA9IHJlY29yZHMubWFwKChyZWNvcmQpID0+IHtcbiAgICAgIGNvbnN0IHsgSWQ6IGlkLCB0eXBlOiBydHlwZSwgYXR0cmlidXRlcywgLi4ucmVjIH0gPSByZWNvcmQ7XG4gICAgICBpZiAoIWlkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVjb3JkIGlkIGlzIG5vdCBmb3VuZCBpbiByZWNvcmQuJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBzb2JqZWN0VHlwZSA9IHR5cGUgfHwgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy50eXBlKSB8fCBydHlwZTtcbiAgICAgIGlmICghc29iamVjdFR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBTT2JqZWN0IFR5cGUgZGVmaW5lZCBpbiByZWNvcmQnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGlkLCBhdHRyaWJ1dGVzOiB7IHR5cGU6IHNvYmplY3RUeXBlIH0sIC4uLnJlYyB9O1xuICAgIH0pO1xuICAgIGNvbnN0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdjb21wb3NpdGUnLCAnc29iamVjdHMnXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFsbE9yTm9uZTogb3B0aW9ucy5hbGxPck5vbmUgfHwgZmFsc2UsXG4gICAgICAgIHJlY29yZHM6IF9yZWNvcmRzLFxuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcHNlcnQgcmVjb3Jkc1xuICAgKi9cbiAgdXBzZXJ0PFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gICAgRmllbGROYW1lcyBleHRlbmRzIFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+ID0gU09iamVjdEZpZWxkTmFtZXM8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IElucHV0UmVjb3JkW10sXG4gICAgZXh0SWRGaWVsZDogRmllbGROYW1lcyxcbiAgICBvcHRpb25zPzogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydDxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+LFxuICAgIEZpZWxkTmFtZXMgZXh0ZW5kcyBTT2JqZWN0RmllbGROYW1lczxTLCBOPiA9IFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+XG4gID4oXG4gICAgdHlwZTogTixcbiAgICByZWNvcmQ6IElucHV0UmVjb3JkLFxuICAgIGV4dElkRmllbGQ6IEZpZWxkTmFtZXMsXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8VXBzZXJ0UmVzdWx0PjtcbiAgdXBzZXJ0PFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gICAgRmllbGROYW1lcyBleHRlbmRzIFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+ID0gU09iamVjdEZpZWxkTmFtZXM8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IElucHV0UmVjb3JkIHwgSW5wdXRSZWNvcmRbXSxcbiAgICBleHRJZEZpZWxkOiBGaWVsZE5hbWVzLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFVwc2VydFJlc3VsdCB8IFVwc2VydFJlc3VsdFtdPjtcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB0eXBlXG4gICAqIEBwYXJhbSByZWNvcmRzXG4gICAqIEBwYXJhbSBleHRJZEZpZWxkXG4gICAqIEBwYXJhbSBvcHRpb25zXG4gICAqL1xuICBhc3luYyB1cHNlcnQoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZHM6IFJlY29yZCB8IFJlY29yZFtdLFxuICAgIGV4dElkRmllbGQ6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT4ge1xuICAgIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KHJlY29yZHMpO1xuICAgIGNvbnN0IF9yZWNvcmRzID0gQXJyYXkuaXNBcnJheShyZWNvcmRzKSA/IHJlY29yZHMgOiBbcmVjb3Jkc107XG4gICAgaWYgKF9yZWNvcmRzLmxlbmd0aCA+IHRoaXMuX21heFJlcXVlc3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhjZWVkZWQgbWF4IGxpbWl0IG9mIGNvbmN1cnJlbnQgY2FsbCcpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBfcmVjb3Jkcy5tYXAoKHJlY29yZCkgPT4ge1xuICAgICAgICBjb25zdCB7IFtleHRJZEZpZWxkXTogZXh0SWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICAgICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgdHlwZSwgZXh0SWRGaWVsZCwgZXh0SWRdLmpvaW4oXG4gICAgICAgICAgJy8nLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFNhdmVSZXN1bHQ+KFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlYyksXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5vQ29udGVudFJlc3BvbnNlOiB7IHN1Y2Nlc3M6IHRydWUsIGVycm9yczogW10gfSxcbiAgICAgICAgICB9LFxuICAgICAgICApLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAvLyBCZSBhd2FyZSB0aGF0IGBhbGxPck5vbmVgIG9wdGlvbiBpbiB1cHNlcnQgbWV0aG9kXG4gICAgICAgICAgLy8gd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzLlxuICAgICAgICAgIC8vIEl0IG9ubHkgcmFpc2VzIGVycm9yIHdoZW4gbWV0IGF0IGxlYXN0IG9uZSBmYWlsZWQgcmVxdWVzdC5cbiAgICAgICAgICBpZiAoIWlzQXJyYXkgfHwgb3B0aW9ucy5hbGxPck5vbmUgfHwgIWVyci5lcnJvckNvZGUpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRvU2F2ZVJlc3VsdChlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gICAgcmV0dXJuIGlzQXJyYXkgPyByZXN1bHRzIDogcmVzdWx0c1swXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgcmVjb3Jkc1xuICAgKi9cbiAgZGVzdHJveTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIGlkczogc3RyaW5nW10sXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgZGVzdHJveTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIGlkOiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD47XG4gIGRlc3Ryb3k8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIGlkc1xuICAgKiBAcGFyYW0gb3B0aW9uc1xuICAgKi9cbiAgYXN5bmMgZGVzdHJveShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT4ge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGlkcylcbiAgICAgID8gLy8gY2hlY2sgdGhlIHZlcnNpb24gd2hldGhlciBTT2JqZWN0IGNvbGxlY3Rpb24gQVBJIGlzIHN1cHBvcnRlZCAoNDIuMClcbiAgICAgICAgdGhpcy5fZW5zdXJlVmVyc2lvbig0MilcbiAgICAgICAgPyB0aGlzLl9kZXN0cm95TWFueSh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fZGVzdHJveVBhcmFsbGVsKHR5cGUsIGlkcywgb3B0aW9ucylcbiAgICAgIDogdGhpcy5fZGVzdHJveVNpbmdsZSh0eXBlLCBpZHMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9kZXN0cm95U2luZ2xlKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBpZDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdzb2JqZWN0cycsIHR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgdXJsLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMgfHwge30sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBub0NvbnRlbnRSZXNwb25zZTogeyBpZCwgc3VjY2VzczogdHJ1ZSwgZXJyb3JzOiBbXSB9LFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9kZXN0cm95UGFyYWxsZWwodHlwZTogc3RyaW5nLCBpZHM6IHN0cmluZ1tdLCBvcHRpb25zOiBEbWxPcHRpb25zKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgaWRzLm1hcCgoaWQpID0+XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaW5nbGUodHlwZSwgaWQsIG9wdGlvbnMpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAvLyBCZSBhd2FyZSB0aGF0IGBhbGxPck5vbmVgIG9wdGlvbiBpbiBwYXJhbGxlbCBtb2RlXG4gICAgICAgICAgLy8gd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzLlxuICAgICAgICAgIC8vIEl0IG9ubHkgcmFpc2VzIGVycm9yIHdoZW4gbWV0IGF0IGxlYXN0IG9uZSBmYWlsZWQgcmVxdWVzdC5cbiAgICAgICAgICBpZiAob3B0aW9ucy5hbGxPck5vbmUgfHwgIWVyci5lcnJvckNvZGUpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRvU2F2ZVJlc3VsdChlcnIpO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfZGVzdHJveU1hbnkoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIGlkczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxTYXZlUmVzdWx0W10+IHtcbiAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBpZiAoaWRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX2Rlc3Ryb3lNYW55KFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgaWRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fZGVzdHJveU1hbnkodHlwZSwgaWRzLnNsaWNlKE1BWF9ETUxfQ09VTlQpLCBvcHRpb25zKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBsZXQgdXJsID1cbiAgICAgIFt0aGlzLl9iYXNlVXJsKCksICdjb21wb3NpdGUnLCAnc29iamVjdHM/aWRzPSddLmpvaW4oJy8nKSArIGlkcy5qb2luKCcsJyk7XG4gICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lKSB7XG4gICAgICB1cmwgKz0gJyZhbGxPck5vbmU9dHJ1ZSc7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHVybCxcbiAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyB8fCB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIENvbm5lY3Rpb24jZGVzdHJveSgpXG4gICAqL1xuICBkZWxldGUgPSB0aGlzLmRlc3Ryb3k7XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgQ29ubmVjdGlvbiNkZXN0cm95KClcbiAgICovXG4gIGRlbCA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogRGVzY3JpYmUgU09iamVjdCBtZXRhZGF0YVxuICAgKi9cbiAgYXN5bmMgZGVzY3JpYmUodHlwZTogc3RyaW5nKTogUHJvbWlzZTxEZXNjcmliZVNPYmplY3RSZXN1bHQ+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlLCAnZGVzY3JpYmUnXS5qb2luKCcvJyk7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlU09iamVjdFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBnbG9iYWwgU09iamVjdHNcbiAgICovXG4gIGFzeW5jIGRlc2NyaWJlR2xvYmFsKCkge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2Jhc2VVcmwoKX0vc29iamVjdHNgO1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsKTtcbiAgICByZXR1cm4gYm9keSBhcyBEZXNjcmliZUdsb2JhbFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgU09iamVjdCBpbnN0YW5jZVxuICAgKi9cbiAgc29iamVjdDxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+Pih0eXBlOiBOKTogU09iamVjdDxTLCBOPjtcbiAgc29iamVjdDxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+Pih0eXBlOiBzdHJpbmcpOiBTT2JqZWN0PFMsIE4+O1xuICBzb2JqZWN0PE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4+KHR5cGU6IE4gfCBzdHJpbmcpOiBTT2JqZWN0PFMsIE4+IHtcbiAgICBjb25zdCBzbyA9XG4gICAgICAodGhpcy5zb2JqZWN0c1t0eXBlIGFzIE5dIGFzIFNPYmplY3Q8UywgTj4gfCB1bmRlZmluZWQpIHx8XG4gICAgICBuZXcgU09iamVjdCh0aGlzLCB0eXBlIGFzIE4pO1xuICAgIHRoaXMuc29iamVjdHNbdHlwZSBhcyBOXSA9IHNvO1xuICAgIHJldHVybiBzbztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgaWRlbnRpdHkgaW5mb3JtYXRpb24gb2YgY3VycmVudCB1c2VyXG4gICAqL1xuICBhc3luYyBpZGVudGl0eShvcHRpb25zOiB7IGhlYWRlcnM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSB9ID0ge30pIHtcbiAgICBsZXQgdXJsID0gdGhpcy51c2VySW5mbyAmJiB0aGlzLnVzZXJJbmZvLnVybDtcbiAgICBpZiAoIXVybCkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5yZXF1ZXN0PHsgaWRlbnRpdHk6IHN0cmluZyB9Pih7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHVybDogdGhpcy5fYmFzZVVybCgpLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICB9KTtcbiAgICAgIHVybCA9IHJlcy5pZGVudGl0eTtcbiAgICB9XG4gICAgdXJsICs9ICc/Zm9ybWF0PWpzb24nO1xuICAgIGlmICh0aGlzLmFjY2Vzc1Rva2VuKSB7XG4gICAgICB1cmwgKz0gYCZvYXV0aF90b2tlbj0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLmFjY2Vzc1Rva2VuKX1gO1xuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8SWRlbnRpdHlJbmZvPih7IG1ldGhvZDogJ0dFVCcsIHVybCB9KTtcbiAgICB0aGlzLnVzZXJJbmZvID0ge1xuICAgICAgaWQ6IHJlcy51c2VyX2lkLFxuICAgICAgb3JnYW5pemF0aW9uSWQ6IHJlcy5vcmdhbml6YXRpb25faWQsXG4gICAgICB1cmw6IHJlcy5pZCxcbiAgICB9O1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICAvKipcbiAgICogTGlzdCByZWNlbnRseSB2aWV3ZWQgcmVjb3Jkc1xuICAgKi9cbiAgYXN5bmMgcmVjZW50KHR5cGU/OiBzdHJpbmcgfCBudW1iZXIsIGxpbWl0PzogbnVtYmVyKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tcGFyYW0tcmVhc3NpZ24gKi9cbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgICBsaW1pdCA9IHR5cGU7XG4gICAgICB0eXBlID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBsZXQgdXJsO1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlXS5qb2luKCcvJyk7XG4gICAgICBjb25zdCB7IHJlY2VudEl0ZW1zIH0gPSBhd2FpdCB0aGlzLnJlcXVlc3Q8eyByZWNlbnRJdGVtczogUmVjb3JkW10gfT4oXG4gICAgICAgIHVybCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbGltaXQgPyByZWNlbnRJdGVtcy5zbGljZSgwLCBsaW1pdCkgOiByZWNlbnRJdGVtcztcbiAgICB9XG4gICAgdXJsID0gYCR7dGhpcy5fYmFzZVVybCgpfS9yZWNlbnRgO1xuICAgIGlmIChsaW1pdCkge1xuICAgICAgdXJsICs9IGA/bGltaXQ9JHtsaW1pdH1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFJlY29yZFtdPih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHVwZGF0ZWQgcmVjb3Jkc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlZChcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgc3RhcnQ6IHN0cmluZyB8IERhdGUsXG4gICAgZW5kOiBzdHJpbmcgfCBEYXRlLFxuICApOiBQcm9taXNlPFVwZGF0ZWRSZXN1bHQ+IHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1wYXJhbS1yZWFzc2lnbiAqL1xuICAgIGxldCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlLCAndXBkYXRlZCddLmpvaW4oJy8nKTtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgc3RhcnQgPSBuZXcgRGF0ZShzdGFydCk7XG4gICAgfVxuICAgIHN0YXJ0ID0gZm9ybWF0RGF0ZShzdGFydCk7XG4gICAgdXJsICs9IGA/c3RhcnQ9JHtlbmNvZGVVUklDb21wb25lbnQoc3RhcnQpfWA7XG4gICAgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmQgPSBuZXcgRGF0ZShlbmQpO1xuICAgIH1cbiAgICBlbmQgPSBmb3JtYXREYXRlKGVuZCk7XG4gICAgdXJsICs9IGAmZW5kPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGVuZCl9YDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgVXBkYXRlZFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBkZWxldGVkIHJlY29yZHNcbiAgICovXG4gIGFzeW5jIGRlbGV0ZWQoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHN0YXJ0OiBzdHJpbmcgfCBEYXRlLFxuICAgIGVuZDogc3RyaW5nIHwgRGF0ZSxcbiAgKTogUHJvbWlzZTxEZWxldGVkUmVzdWx0PiB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tcGFyYW0tcmVhc3NpZ24gKi9cbiAgICBsZXQgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgdHlwZSwgJ2RlbGV0ZWQnXS5qb2luKCcvJyk7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHN0YXJ0ID0gbmV3IERhdGUoc3RhcnQpO1xuICAgIH1cbiAgICBzdGFydCA9IGZvcm1hdERhdGUoc3RhcnQpO1xuICAgIHVybCArPSBgP3N0YXJ0PSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN0YXJ0KX1gO1xuXG4gICAgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmQgPSBuZXcgRGF0ZShlbmQpO1xuICAgIH1cbiAgICBlbmQgPSBmb3JtYXREYXRlKGVuZCk7XG4gICAgdXJsICs9IGAmZW5kPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGVuZCl9YDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVsZXRlZFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbGlzdCBvZiBhbGwgdGFic1xuICAgKi9cbiAgYXN5bmMgdGFicygpOiBQcm9taXNlPERlc2NyaWJlVGFiW10+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAndGFicyddLmpvaW4oJy8nKTtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVzY3JpYmVUYWJbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGN1cnJlbnQgc3lzdGVtIGxpbWl0IGluIHRoZSBvcmdhbml6YXRpb25cbiAgICovXG4gIGFzeW5jIGxpbWl0cygpOiBQcm9taXNlPE9yZ2FuaXphdGlvbkxpbWl0c0luZm8+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnbGltaXRzJ10uam9pbignLycpO1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsKTtcbiAgICByZXR1cm4gYm9keSBhcyBPcmdhbml6YXRpb25MaW1pdHNJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB0aGVtZSBpbmZvXG4gICAqL1xuICBhc3luYyB0aGVtZSgpOiBQcm9taXNlPERlc2NyaWJlVGhlbWU+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAndGhlbWUnXS5qb2luKCcvJyk7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlVGhlbWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbGwgcmVnaXN0ZXJlZCBnbG9iYWwgcXVpY2sgYWN0aW9uc1xuICAgKi9cbiAgYXN5bmMgcXVpY2tBY3Rpb25zKCk6IFByb21pc2U8RGVzY3JpYmVRdWlja0FjdGlvblJlc3VsdFtdPiB7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCgnL3F1aWNrQWN0aW9ucycpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlUXVpY2tBY3Rpb25SZXN1bHRbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcmVmZXJlbmNlIGZvciBzcGVjaWZpZWQgZ2xvYmFsIHF1aWNrIGFjdGlvblxuICAgKi9cbiAgcXVpY2tBY3Rpb24oYWN0aW9uTmFtZTogc3RyaW5nKTogUXVpY2tBY3Rpb248Uz4ge1xuICAgIHJldHVybiBuZXcgUXVpY2tBY3Rpb24odGhpcywgYC9xdWlja0FjdGlvbnMvJHthY3Rpb25OYW1lfWApO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vZHVsZSB3aGljaCBtYW5hZ2VzIHByb2Nlc3MgcnVsZXMgYW5kIGFwcHJvdmFsIHByb2Nlc3Nlc1xuICAgKi9cbiAgcHJvY2VzcyA9IG5ldyBQcm9jZXNzKHRoaXMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBDb25uZWN0aW9uO1xuIl19