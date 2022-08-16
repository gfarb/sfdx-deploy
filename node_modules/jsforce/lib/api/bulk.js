"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");

var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");

var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");

var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");

var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");

var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");

var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");

var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");

var _Object$keys2 = require("@babel/runtime-corejs3/core-js-stable/object/keys");

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.promise");

require("core-js/modules/es.string.replace");

_Object$defineProperty(exports, "__esModule", {
  value: true
});

exports.default = exports.IngestJobV2 = exports.QueryJobV2 = exports.BulkV2 = exports.Bulk = exports.Batch = exports.Job = void 0;

var _weakMap = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/weak-map"));

var _now = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/date/now"));

var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));

var _classPrivateFieldGet3 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/classPrivateFieldGet"));

var _classPrivateFieldSet2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/classPrivateFieldSet"));

var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));

var _setTimeout2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/set-timeout"));

var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/parse-int"));

var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));

var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));

var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));

var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));

var _trim = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/trim"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));

var _events = require("events");

var _stream = require("stream");

var _multistream = _interopRequireDefault(require("multistream"));

var _recordStream = require("../record-stream");

var _httpApi = _interopRequireDefault(require("../http-api"));

var _jsforce = require("../jsforce");

var _stream2 = require("../util/stream");

var _function = require("../util/function");

function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context4; _forEachInstanceProperty(_context4 = ownKeys(Object(source), true)).call(_context4, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context5; _forEachInstanceProperty(_context5 = ownKeys(Object(source))).call(_context5, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; }

/**
 * Class for Bulk API Job
 */
class Job extends _events.EventEmitter {
  /**
   *
   */
  constructor(bulk, type, operation, options, jobId) {
    super();
    (0, _defineProperty2.default)(this, "type", void 0);
    (0, _defineProperty2.default)(this, "operation", void 0);
    (0, _defineProperty2.default)(this, "options", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "state", void 0);
    (0, _defineProperty2.default)(this, "_bulk", void 0);
    (0, _defineProperty2.default)(this, "_batches", void 0);
    (0, _defineProperty2.default)(this, "_jobInfo", void 0);
    (0, _defineProperty2.default)(this, "_error", void 0);
    this._bulk = bulk;
    this.type = type;
    this.operation = operation;
    this.options = options || {};
    this.id = jobId !== null && jobId !== void 0 ? jobId : null;
    this.state = this.id ? 'Open' : 'Unknown';
    this._batches = {}; // default error handler to keep the latest error

    this.on('error', error => this._error = error);
  }
  /**
   * Return latest jobInfo from cache
   */


  info() {
    // if cache is not available, check the latest
    if (!this._jobInfo) {
      this._jobInfo = this.check();
    }

    return this._jobInfo;
  }
  /**
   * Open new job and get jobinfo
   */


  open() {
    const bulk = this._bulk;
    const options = this.options; // if sobject type / operation is not provided

    if (!this.type || !this.operation) {
      throw new Error('type / operation is required to open a new job');
    } // if not requested opening job


    if (!this._jobInfo) {
      var _context;

      let operation = this.operation.toLowerCase();

      if (operation === 'harddelete') {
        operation = 'hardDelete';
      }

      if (operation === 'queryall') {
        operation = 'queryAll';
      }

      const body = (0, _trim.default)(_context = `
<?xml version="1.0" encoding="UTF-8"?>
<jobInfo  xmlns="http://www.force.com/2009/06/asyncapi/dataload">
  <operation>${operation}</operation>
  <object>${this.type}</object>
  ${options.extIdField ? `<externalIdFieldName>${options.extIdField}</externalIdFieldName>` : ''}
  ${options.concurrencyMode ? `<concurrencyMode>${options.concurrencyMode}</concurrencyMode>` : ''}
  ${options.assignmentRuleId ? `<assignmentRuleId>${options.assignmentRuleId}</assignmentRuleId>` : ''}
  <contentType>CSV</contentType>
</jobInfo>
      `).call(_context);

      this._jobInfo = (async () => {
        try {
          const res = await bulk._request({
            method: 'POST',
            path: '/job',
            body,
            headers: {
              'Content-Type': 'application/xml; charset=utf-8'
            },
            responseType: 'application/xml'
          });
          this.emit('open', res.jobInfo);
          this.id = res.jobInfo.id;
          this.state = res.jobInfo.state;
          return res.jobInfo;
        } catch (err) {
          this.emit('error', err);
          throw err;
        }
      })();
    }

    return this._jobInfo;
  }
  /**
   * Create a new batch instance in the job
   */


  createBatch() {
    const batch = new Batch(this);
    batch.on('queue', () => {
      this._batches[batch.id] = batch;
    });
    return batch;
  }
  /**
   * Get a batch instance specified by given batch ID
   */


  batch(batchId) {
    let batch = this._batches[batchId];

    if (!batch) {
      batch = new Batch(this, batchId);
      this._batches[batchId] = batch;
    }

    return batch;
  }
  /**
   * Check the latest job status from server
   */


  check() {
    const bulk = this._bulk;
    const logger = bulk._logger;

    this._jobInfo = (async () => {
      const jobId = await this.ready();
      const res = await bulk._request({
        method: 'GET',
        path: '/job/' + jobId,
        responseType: 'application/xml'
      });
      logger.debug(res.jobInfo);
      this.id = res.jobInfo.id;
      this.type = res.jobInfo.object;
      this.operation = res.jobInfo.operation;
      this.state = res.jobInfo.state;
      return res.jobInfo;
    })();

    return this._jobInfo;
  }
  /**
   * Wait till the job is assigned to server
   */


  ready() {
    return this.id ? _promise.default.resolve(this.id) : this.open().then(({
      id
    }) => id);
  }
  /**
   * List all registered batch info in job
   */


  async list() {
    const bulk = this._bulk;
    const logger = bulk._logger;
    const jobId = await this.ready();
    const res = await bulk._request({
      method: 'GET',
      path: '/job/' + jobId + '/batch',
      responseType: 'application/xml'
    });
    logger.debug(res.batchInfoList.batchInfo);
    const batchInfoList = (0, _isArray.default)(res.batchInfoList.batchInfo) ? res.batchInfoList.batchInfo : [res.batchInfoList.batchInfo];
    return batchInfoList;
  }
  /**
   * Close opened job
   */


  async close() {
    if (!this.id) {
      return;
    }

    try {
      const jobInfo = await this._changeState('Closed');
      this.id = null;
      this.emit('close', jobInfo);
      return jobInfo;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
  /**
   * Set the status to abort
   */


  async abort() {
    if (!this.id) {
      return;
    }

    try {
      const jobInfo = await this._changeState('Aborted');
      this.id = null;
      this.emit('abort', jobInfo);
      return jobInfo;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
  /**
   * @private
   */


  async _changeState(state) {
    const bulk = this._bulk;
    const logger = bulk._logger;

    this._jobInfo = (async () => {
      var _context2;

      const jobId = await this.ready();
      const body = (0, _trim.default)(_context2 = ` 
<?xml version="1.0" encoding="UTF-8"?>
  <jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
  <state>${state}</state>
</jobInfo>
      `).call(_context2);
      const res = await bulk._request({
        method: 'POST',
        path: '/job/' + jobId,
        body: body,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8'
        },
        responseType: 'application/xml'
      });
      logger.debug(res.jobInfo);
      this.state = res.jobInfo.state;
      return res.jobInfo;
    })();

    return this._jobInfo;
  }

}
/*--------------------------------------------*/


exports.Job = Job;

class PollingTimeoutError extends Error {
  /**
   *
   */
  constructor(message, jobId, batchId) {
    super(message);
    (0, _defineProperty2.default)(this, "jobId", void 0);
    (0, _defineProperty2.default)(this, "batchId", void 0);
    this.name = 'PollingTimeout';
    this.jobId = jobId;
    this.batchId = batchId;
  }

}

class JobPollingTimeoutError extends Error {
  /**
   *
   */
  constructor(message, jobId) {
    super(message);
    (0, _defineProperty2.default)(this, "jobId", void 0);
    this.name = 'JobPollingTimeout';
    this.jobId = jobId;
  }

}
/*--------------------------------------------*/

/**
 * Batch (extends Writable)
 */


class Batch extends _stream.Writable {
  /**
   *
   */
  constructor(job, id) {
    super({
      objectMode: true
    });
    (0, _defineProperty2.default)(this, "job", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "_bulk", void 0);
    (0, _defineProperty2.default)(this, "_uploadStream", void 0);
    (0, _defineProperty2.default)(this, "_downloadStream", void 0);
    (0, _defineProperty2.default)(this, "_dataStream", void 0);
    (0, _defineProperty2.default)(this, "_result", void 0);
    (0, _defineProperty2.default)(this, "_error", void 0);
    (0, _defineProperty2.default)(this, "run", this.execute);
    (0, _defineProperty2.default)(this, "exec", this.execute);
    this.job = job;
    this.id = id;
    this._bulk = job._bulk; // default error handler to keep the latest error

    this.on('error', error => this._error = error); //
    // setup data streams
    //

    const converterOptions = {
      nullValue: '#N/A'
    };
    const uploadStream = this._uploadStream = new _recordStream.Serializable();
    const uploadDataStream = uploadStream.stream('csv', converterOptions);
    const downloadStream = this._downloadStream = new _recordStream.Parsable();
    const downloadDataStream = downloadStream.stream('csv', converterOptions);
    this.on('finish', () => uploadStream.end());
    uploadDataStream.once('readable', async () => {
      try {
        // ensure the job is opened in server or job id is already assigned
        await this.job.ready(); // pipe upload data to batch API request stream

        uploadDataStream.pipe(this._createRequestStream());
      } catch (err) {
        this.emit('error', err);
      }
    }); // duplex data stream, opened access to API programmers by Batch#stream()

    this._dataStream = (0, _stream2.concatStreamsAsDuplex)(uploadDataStream, downloadDataStream);
  }
  /**
   * Connect batch API and create stream instance of request/response
   *
   * @private
   */


  _createRequestStream() {
    const bulk = this._bulk;
    const logger = bulk._logger;

    const req = bulk._request({
      method: 'POST',
      path: '/job/' + this.job.id + '/batch',
      headers: {
        'Content-Type': 'text/csv'
      },
      responseType: 'application/xml'
    });

    (async () => {
      try {
        const res = await req;
        logger.debug(res.batchInfo);
        this.id = res.batchInfo.id;
        this.emit('queue', res.batchInfo);
      } catch (err) {
        this.emit('error', err);
      }
    })();

    return req.stream();
  }
  /**
   * Implementation of Writable
   */


  _write(record_, enc, cb) {
    const {
      Id,
      type,
      attributes
    } = record_,
          rrec = (0, _objectWithoutProperties2.default)(record_, ["Id", "type", "attributes"]);
    let record;

    switch (this.job.operation) {
      case 'insert':
        record = rrec;
        break;

      case 'delete':
      case 'hardDelete':
        record = {
          Id
        };
        break;

      default:
        record = _objectSpread({
          Id
        }, rrec);
    }

    this._uploadStream.write(record, enc, cb);
  }
  /**
   * Returns duplex stream which accepts CSV data input and batch result output
   */


  stream() {
    return this._dataStream;
  }
  /**
   * Execute batch operation
   */


  execute(input) {
    // if batch is already executed
    if (this._result) {
      throw new Error('Batch already executed.');
    }

    this._result = new _promise.default((resolve, reject) => {
      this.once('response', resolve);
      this.once('error', reject);
    });

    if ((0, _function.isObject)(input) && 'pipe' in input && (0, _function.isFunction)(input.pipe)) {
      // if input has stream.Readable interface
      input.pipe(this._dataStream);
    } else {
      if ((0, _isArray.default)(input)) {
        for (const record of input) {
          for (const key of (0, _keys.default)(record)) {
            if (typeof record[key] === 'boolean') {
              record[key] = String(record[key]);
            }
          }

          this.write(record);
        }

        this.end();
      } else if (typeof input === 'string') {
        this._dataStream.write(input, 'utf8');

        this._dataStream.end();
      }
    } // return Batch instance for chaining


    return this;
  }

  /**
   * Promise/A+ interface
   * Delegate to promise, return promise instance for batch result
   */
  then(onResolved, onReject) {
    if (!this._result) {
      this.execute();
    }

    return this._result.then(onResolved, onReject);
  }
  /**
   * Check the latest batch status in server
   */


  async check() {
    const bulk = this._bulk;
    const logger = bulk._logger;
    const jobId = this.job.id;
    const batchId = this.id;

    if (!jobId || !batchId) {
      throw new Error('Batch not started.');
    }

    const res = await bulk._request({
      method: 'GET',
      path: '/job/' + jobId + '/batch/' + batchId,
      responseType: 'application/xml'
    });
    logger.debug(res.batchInfo);
    return res.batchInfo;
  }
  /**
   * Polling the batch result and retrieve
   */


  poll(interval, timeout) {
    const jobId = this.job.id;
    const batchId = this.id;

    if (!jobId || !batchId) {
      throw new Error('Batch not started.');
    }

    const startTime = new Date().getTime();

    const poll = async () => {
      const now = new Date().getTime();

      if (startTime + timeout < now) {
        const err = new PollingTimeoutError('Polling time out. Job Id = ' + jobId + ' , batch Id = ' + batchId, jobId, batchId);
        this.emit('error', err);
        return;
      }

      let res;

      try {
        res = await this.check();
      } catch (err) {
        this.emit('error', err);
        return;
      }

      if (res.state === 'Failed') {
        if ((0, _parseInt2.default)(res.numberRecordsProcessed, 10) > 0) {
          this.retrieve();
        } else {
          this.emit('error', new Error(res.stateMessage));
        }
      } else if (res.state === 'Completed') {
        this.retrieve();
      } else {
        this.emit('progress', res);
        (0, _setTimeout2.default)(poll, interval);
      }
    };

    (0, _setTimeout2.default)(poll, interval);
  }
  /**
   * Retrieve batch result
   */


  async retrieve() {
    const bulk = this._bulk;
    const jobId = this.job.id;
    const job = this.job;
    const batchId = this.id;

    if (!jobId || !batchId) {
      throw new Error('Batch not started.');
    }

    try {
      const resp = await bulk._request({
        method: 'GET',
        path: '/job/' + jobId + '/batch/' + batchId + '/result'
      });
      let results;

      if (job.operation === 'query' || job.operation === 'queryAll') {
        var _context3;

        const res = resp;
        let resultId = res['result-list'].result;
        results = (0, _map.default)(_context3 = (0, _isArray.default)(resultId) ? resultId : [resultId]).call(_context3, id => ({
          id,
          batchId,
          jobId
        }));
      } else {
        const res = resp;
        results = (0, _map.default)(res).call(res, ret => ({
          id: ret.Id || null,
          success: ret.Success === 'true',
          errors: ret.Error ? [ret.Error] : []
        }));
      }

      this.emit('response', results);
      return results;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
  /**
   * Fetch query result as a record stream
   * @param {String} resultId - Result id
   * @returns {RecordStream} - Record stream, convertible to CSV data stream
   */


  result(resultId) {
    const jobId = this.job.id;
    const batchId = this.id;

    if (!jobId || !batchId) {
      throw new Error('Batch not started.');
    }

    const resultStream = new _recordStream.Parsable();
    const resultDataStream = resultStream.stream('csv');

    this._bulk._request({
      method: 'GET',
      path: '/job/' + jobId + '/batch/' + batchId + '/result/' + resultId,
      responseType: 'application/octet-stream'
    }).stream().pipe(resultDataStream);

    return resultStream;
  }

}
/*--------------------------------------------*/

/**
 *
 */


exports.Batch = Batch;

class BulkApi extends _httpApi.default {
  beforeSend(request) {
    var _this$_conn$accessTok;

    request.headers = _objectSpread(_objectSpread({}, request.headers), {}, {
      'X-SFDC-SESSION': (_this$_conn$accessTok = this._conn.accessToken) !== null && _this$_conn$accessTok !== void 0 ? _this$_conn$accessTok : ''
    });
  }

  isSessionExpired(response) {
    return response.statusCode === 400 && /<exceptionCode>InvalidSessionId<\/exceptionCode>/.test(response.body);
  }

  hasErrorInResponseBody(body) {
    return !!body.error;
  }

  parseError(body) {
    return {
      errorCode: body.error.exceptionCode,
      message: body.error.exceptionMessage
    };
  }

}

class BulkApiV2 extends _httpApi.default {
  hasErrorInResponseBody(body) {
    return (0, _isArray.default)(body) && typeof body[0] === 'object' && 'errorCode' in body[0];
  }

  isSessionExpired(response) {
    return response.statusCode === 401 && /INVALID_SESSION_ID/.test(response.body);
  }

  parseError(body) {
    return {
      errorCode: body[0].errorCode,
      message: body[0].message
    };
  }

}
/*--------------------------------------------*/

/**
 * Class for Bulk API
 *
 * @class
 */


class Bulk {
  /**
   * Polling interval in milliseconds
   */

  /**
   * Polling timeout in milliseconds
   * @type {Number}
   */

  /**
   *
   */
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "pollInterval", 1000);
    (0, _defineProperty2.default)(this, "pollTimeout", 10000);
    this._conn = conn;
    this._logger = conn._logger;
  }
  /**
   *
   */


  _request(request_) {
    const conn = this._conn;
    const {
      path,
      responseType
    } = request_,
          rreq = (0, _objectWithoutProperties2.default)(request_, ["path", "responseType"]);
    const baseUrl = [conn.instanceUrl, 'services/async', conn.version].join('/');

    const request = _objectSpread(_objectSpread({}, rreq), {}, {
      url: baseUrl + path
    });

    return new BulkApi(this._conn, {
      responseType
    }).request(request);
  }
  /**
   * Create and start bulkload job and batch
   */


  load(type, operation, optionsOrInput, input) {
    let options = {};

    if (typeof optionsOrInput === 'string' || (0, _isArray.default)(optionsOrInput) || (0, _function.isObject)(optionsOrInput) && 'pipe' in optionsOrInput && typeof optionsOrInput.pipe === 'function') {
      // when options is not plain hash object, it is omitted
      input = optionsOrInput;
    } else {
      options = optionsOrInput;
    }

    const job = this.createJob(type, operation, options);
    const batch = job.createBatch();

    const cleanup = () => job.close();

    const cleanupOnError = err => {
      if (err.name !== 'PollingTimeout') {
        cleanup();
      }
    };

    batch.on('response', cleanup);
    batch.on('error', cleanupOnError);
    batch.on('queue', () => {
      batch === null || batch === void 0 ? void 0 : batch.poll(this.pollInterval, this.pollTimeout);
    });
    return batch.execute(input);
  }
  /**
   * Execute bulk query and get record stream
   */


  query(soql) {
    const m = soql.replace(/\([\s\S]+\)/g, '').match(/FROM\s+(\w+)/i);

    if (!m) {
      throw new Error('No sobject type found in query, maybe caused by invalid SOQL.');
    }

    const type = m[1];
    const recordStream = new _recordStream.Parsable();
    const dataStream = recordStream.stream('csv');

    (async () => {
      try {
        const results = await this.load(type, 'query', soql);
        const streams = (0, _map.default)(results).call(results, result => this.job(result.jobId).batch(result.batchId).result(result.id).stream());
        (0, _multistream.default)(streams).pipe(dataStream);
      } catch (err) {
        recordStream.emit('error', err);
      }
    })();

    return recordStream;
  }
  /**
   * Create a new job instance
   */


  createJob(type, operation, options = {}) {
    return new Job(this, type, operation, options);
  }
  /**
   * Get a job instance specified by given job ID
   *
   * @param {String} jobId - Job ID
   * @returns {Bulk~Job}
   */


  job(jobId) {
    return new Job(this, null, null, null, jobId);
  }

}

exports.Bulk = Bulk;

var _connection = new _weakMap.default();

class BulkV2 {
  /**
   * Polling interval in milliseconds
   */

  /**
   * Polling timeout in milliseconds
   * @type {Number}
   */
  constructor(connection) {
    _connection.set(this, {
      writable: true,
      value: void 0
    });

    (0, _defineProperty2.default)(this, "pollInterval", 1000);
    (0, _defineProperty2.default)(this, "pollTimeout", 10000);
    (0, _classPrivateFieldSet2.default)(this, _connection, connection);
  }
  /**
   * Create a new job instance
   */


  createJob(options) {
    return new IngestJobV2({
      connection: (0, _classPrivateFieldGet3.default)(this, _connection),
      jobInfo: options,
      pollingOptions: this
    });
  }

  job(options) {
    return new IngestJobV2({
      connection: (0, _classPrivateFieldGet3.default)(this, _connection),
      jobInfo: options,
      pollingOptions: this
    });
  }
  /**
   * Create, upload, and start bulkload job
   */


  async loadAndWaitForResults(options) {
    const job = this.createJob(options);

    try {
      await job.open();
      await job.uploadData(options.input);
      await job.close();
      await job.poll(options.pollInterval, options.pollTimeout);
      return await job.getAllResults();
    } catch (err) {
      if (err.name !== 'JobPollingTimeoutError') {
        // fires off one last attempt to clean up and ignores the result | error
        job.delete().catch(ignored => ignored);
      }

      throw err;
    }
  }
  /**
   * Execute bulk query and get record stream
   */


  async query(soql, options) {
    const queryJob = new QueryJobV2({
      connection: (0, _classPrivateFieldGet3.default)(this, _connection),
      operation: 'query',
      query: soql,
      pollingOptions: this
    });

    try {
      await queryJob.open();
      await queryJob.poll(options === null || options === void 0 ? void 0 : options.pollInterval, options === null || options === void 0 ? void 0 : options.pollTimeout);
      return await queryJob.getResults();
    } catch (err) {
      if (err.name !== 'JobPollingTimeoutError') {
        // fires off one last attempt to clean up and ignores the result | error
        queryJob.delete().catch(ignored => ignored);
      }

      throw err;
    }
  }

}

exports.BulkV2 = BulkV2;

var _connection2 = new _weakMap.default();

var _operation = new _weakMap.default();

var _query = new _weakMap.default();

var _pollingOptions = new _weakMap.default();

var _queryResults = new _weakMap.default();

var _error = new _weakMap.default();

class QueryJobV2 extends _events.EventEmitter {
  constructor(options) {
    super();

    _connection2.set(this, {
      writable: true,
      value: void 0
    });

    _operation.set(this, {
      writable: true,
      value: void 0
    });

    _query.set(this, {
      writable: true,
      value: void 0
    });

    _pollingOptions.set(this, {
      writable: true,
      value: void 0
    });

    _queryResults.set(this, {
      writable: true,
      value: void 0
    });

    _error.set(this, {
      writable: true,
      value: void 0
    });

    (0, _defineProperty2.default)(this, "jobInfo", void 0);
    (0, _classPrivateFieldSet2.default)(this, _connection2, options.connection);
    (0, _classPrivateFieldSet2.default)(this, _operation, options.operation);
    (0, _classPrivateFieldSet2.default)(this, _query, options.query);
    (0, _classPrivateFieldSet2.default)(this, _pollingOptions, options.pollingOptions); // default error handler to keep the latest error

    this.on('error', error => (0, _classPrivateFieldSet2.default)(this, _error, error));
  }

  async open() {
    try {
      this.jobInfo = await this.createQueryRequest({
        method: 'POST',
        path: '',
        body: (0, _stringify.default)({
          operation: (0, _classPrivateFieldGet3.default)(this, _operation),
          query: (0, _classPrivateFieldGet3.default)(this, _query)
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        responseType: 'application/json'
      });
      this.emit('open');
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
  /**
   * Set the status to abort
   */


  async abort() {
    try {
      var _this$jobInfo;

      const state = 'Aborted';
      this.jobInfo = await this.createQueryRequest({
        method: 'PATCH',
        path: `/${(_this$jobInfo = this.jobInfo) === null || _this$jobInfo === void 0 ? void 0 : _this$jobInfo.id}`,
        body: (0, _stringify.default)({
          state
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        responseType: 'application/json'
      });
      this.emit('aborted');
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async poll(interval = (0, _classPrivateFieldGet3.default)(this, _pollingOptions).pollInterval, timeout = (0, _classPrivateFieldGet3.default)(this, _pollingOptions).pollTimeout) {
    const jobId = getJobIdOrError(this.jobInfo);
    const startTime = (0, _now.default)();

    while (startTime + timeout > (0, _now.default)()) {
      try {
        const res = await this.check();

        switch (res.state) {
          case 'Open':
            throw new Error('Job has not been started');

          case 'Aborted':
            throw new Error('Job has been aborted');

          case 'UploadComplete':
          case 'InProgress':
            await delay(interval);
            break;

          case 'Failed':
            this.emit('failed');
            return;

          case 'JobComplete':
            this.emit('jobcomplete');
            return;
        }
      } catch (err) {
        this.emit('error', err);
        throw err;
      }
    }

    const timeoutError = new JobPollingTimeoutError(`Polling time out. Job Id = ${jobId}`, jobId);
    this.emit('error', timeoutError);
    throw timeoutError;
  }
  /**
   * Check the latest batch status in server
   */


  async check() {
    try {
      const jobInfo = await this.createQueryRequest({
        method: 'GET',
        path: `/${getJobIdOrError(this.jobInfo)}`,
        responseType: 'application/json'
      });
      this.jobInfo = jobInfo;
      return jobInfo;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async getResults() {
    try {
      if ((0, _classPrivateFieldGet3.default)(this, _queryResults)) {
        return (0, _classPrivateFieldGet3.default)(this, _queryResults);
      }

      const results = await this.createQueryRequest({
        method: 'GET',
        path: `/${getJobIdOrError(this.jobInfo)}/results`,
        responseType: 'text/csv'
      });
      (0, _classPrivateFieldSet2.default)(this, _queryResults, results !== null && results !== void 0 ? results : []);
      return (0, _classPrivateFieldGet3.default)(this, _queryResults);
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async delete() {
    return this.createQueryRequest({
      method: 'DELETE',
      path: `/${getJobIdOrError(this.jobInfo)}`
    });
  }

  createQueryRequest(request) {
    const {
      path,
      responseType
    } = request;
    const baseUrl = [(0, _classPrivateFieldGet3.default)(this, _connection2).instanceUrl, 'services/data', `v${(0, _classPrivateFieldGet3.default)(this, _connection2).version}`, 'jobs/query'].join('/');
    return new BulkApiV2((0, _classPrivateFieldGet3.default)(this, _connection2), {
      responseType
    }).request(_objectSpread(_objectSpread({}, request), {}, {
      url: baseUrl + path
    }));
  }

}
/**
 * Class for Bulk API V2 Ingest Job
 */


exports.QueryJobV2 = QueryJobV2;

var _connection3 = new _weakMap.default();

var _pollingOptions2 = new _weakMap.default();

var _jobData = new _weakMap.default();

var _bulkJobSuccessfulResults = new _weakMap.default();

var _bulkJobFailedResults = new _weakMap.default();

var _bulkJobUnprocessedRecords = new _weakMap.default();

var _error2 = new _weakMap.default();

class IngestJobV2 extends _events.EventEmitter {
  /**
   *
   */
  constructor(options) {
    super();

    _connection3.set(this, {
      writable: true,
      value: void 0
    });

    _pollingOptions2.set(this, {
      writable: true,
      value: void 0
    });

    _jobData.set(this, {
      writable: true,
      value: void 0
    });

    _bulkJobSuccessfulResults.set(this, {
      writable: true,
      value: void 0
    });

    _bulkJobFailedResults.set(this, {
      writable: true,
      value: void 0
    });

    _bulkJobUnprocessedRecords.set(this, {
      writable: true,
      value: void 0
    });

    _error2.set(this, {
      writable: true,
      value: void 0
    });

    (0, _defineProperty2.default)(this, "jobInfo", void 0);
    (0, _classPrivateFieldSet2.default)(this, _connection3, options.connection);
    (0, _classPrivateFieldSet2.default)(this, _pollingOptions2, options.pollingOptions);
    this.jobInfo = options.jobInfo;
    (0, _classPrivateFieldSet2.default)(this, _jobData, new JobDataV2({
      createRequest: request => this.createIngestRequest(request),
      job: this
    })); // default error handler to keep the latest error

    this.on('error', error => (0, _classPrivateFieldSet2.default)(this, _error2, error));
  }

  get id() {
    return this.jobInfo.id;
  }

  async open() {
    try {
      var _this$jobInfo2, _this$jobInfo3, _this$jobInfo4, _this$jobInfo5;

      this.jobInfo = await this.createIngestRequest({
        method: 'POST',
        path: '',
        body: (0, _stringify.default)({
          assignmentRuleId: (_this$jobInfo2 = this.jobInfo) === null || _this$jobInfo2 === void 0 ? void 0 : _this$jobInfo2.assignmentRuleId,
          externalIdFieldName: (_this$jobInfo3 = this.jobInfo) === null || _this$jobInfo3 === void 0 ? void 0 : _this$jobInfo3.externalIdFieldName,
          object: (_this$jobInfo4 = this.jobInfo) === null || _this$jobInfo4 === void 0 ? void 0 : _this$jobInfo4.object,
          operation: (_this$jobInfo5 = this.jobInfo) === null || _this$jobInfo5 === void 0 ? void 0 : _this$jobInfo5.operation
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        responseType: 'application/json'
      });
      this.emit('open');
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async uploadData(input) {
    await (0, _classPrivateFieldGet3.default)(this, _jobData).execute(input);
  }

  async getAllResults() {
    const [successfulResults, failedResults, unprocessedRecords] = await _promise.default.all([this.getSuccessfulResults(), this.getFailedResults(), this.getUnprocessedRecords()]);
    return {
      successfulResults,
      failedResults,
      unprocessedRecords
    };
  }
  /**
   * Close opened job
   */


  async close() {
    try {
      const state = 'UploadComplete';
      this.jobInfo = await this.createIngestRequest({
        method: 'PATCH',
        path: `/${this.jobInfo.id}`,
        body: (0, _stringify.default)({
          state
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        responseType: 'application/json'
      });
      this.emit('uploadcomplete');
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }
  /**
   * Set the status to abort
   */


  async abort() {
    try {
      const state = 'Aborted';
      this.jobInfo = await this.createIngestRequest({
        method: 'PATCH',
        path: `/${this.jobInfo.id}`,
        body: (0, _stringify.default)({
          state
        }),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        responseType: 'application/json'
      });
      this.emit('aborted');
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async poll(interval = (0, _classPrivateFieldGet3.default)(this, _pollingOptions2).pollInterval, timeout = (0, _classPrivateFieldGet3.default)(this, _pollingOptions2).pollTimeout) {
    const jobId = getJobIdOrError(this.jobInfo);
    const startTime = (0, _now.default)();

    while (startTime + timeout > (0, _now.default)()) {
      try {
        const res = await this.check();

        switch (res.state) {
          case 'Open':
            throw new Error('Job has not been started');

          case 'Aborted':
            throw new Error('Job has been aborted');

          case 'UploadComplete':
          case 'InProgress':
            await delay(interval);
            break;

          case 'Failed':
            this.emit('failed');
            return;

          case 'JobComplete':
            this.emit('jobcomplete');
            return;
        }
      } catch (err) {
        this.emit('error', err);
        throw err;
      }
    }

    const timeoutError = new JobPollingTimeoutError(`Polling time out. Job Id = ${jobId}`, jobId);
    this.emit('error', timeoutError);
    throw timeoutError;
  }
  /**
   * Check the latest batch status in server
   */


  async check() {
    try {
      const jobInfo = await this.createIngestRequest({
        method: 'GET',
        path: `/${getJobIdOrError(this.jobInfo)}`,
        responseType: 'application/json'
      });
      this.jobInfo = jobInfo;
      return jobInfo;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  async getSuccessfulResults() {
    if ((0, _classPrivateFieldGet3.default)(this, _bulkJobSuccessfulResults)) {
      return (0, _classPrivateFieldGet3.default)(this, _bulkJobSuccessfulResults);
    }

    const results = await this.createIngestRequest({
      method: 'GET',
      path: `/${getJobIdOrError(this.jobInfo)}/successfulResults`,
      responseType: 'text/csv'
    });
    (0, _classPrivateFieldSet2.default)(this, _bulkJobSuccessfulResults, results !== null && results !== void 0 ? results : []);
    return (0, _classPrivateFieldGet3.default)(this, _bulkJobSuccessfulResults);
  }

  async getFailedResults() {
    if ((0, _classPrivateFieldGet3.default)(this, _bulkJobFailedResults)) {
      return (0, _classPrivateFieldGet3.default)(this, _bulkJobFailedResults);
    }

    const results = await this.createIngestRequest({
      method: 'GET',
      path: `/${getJobIdOrError(this.jobInfo)}/failedResults`,
      responseType: 'text/csv'
    });
    (0, _classPrivateFieldSet2.default)(this, _bulkJobFailedResults, results !== null && results !== void 0 ? results : []);
    return (0, _classPrivateFieldGet3.default)(this, _bulkJobFailedResults);
  }

  async getUnprocessedRecords() {
    if ((0, _classPrivateFieldGet3.default)(this, _bulkJobUnprocessedRecords)) {
      return (0, _classPrivateFieldGet3.default)(this, _bulkJobUnprocessedRecords);
    }

    const results = await this.createIngestRequest({
      method: 'GET',
      path: `/${getJobIdOrError(this.jobInfo)}/unprocessedrecords`,
      responseType: 'text/csv'
    });
    (0, _classPrivateFieldSet2.default)(this, _bulkJobUnprocessedRecords, results !== null && results !== void 0 ? results : []);
    return (0, _classPrivateFieldGet3.default)(this, _bulkJobUnprocessedRecords);
  }

  async delete() {
    return this.createIngestRequest({
      method: 'DELETE',
      path: `/${getJobIdOrError(this.jobInfo)}`
    });
  }

  createIngestRequest(request) {
    const {
      path,
      responseType
    } = request;
    const baseUrl = [(0, _classPrivateFieldGet3.default)(this, _connection3).instanceUrl, 'services/data', `v${(0, _classPrivateFieldGet3.default)(this, _connection3).version}`, 'jobs/ingest'].join('/');
    return new BulkApiV2((0, _classPrivateFieldGet3.default)(this, _connection3), {
      responseType
    }).request(_objectSpread(_objectSpread({}, request), {}, {
      url: baseUrl + path
    }));
  }

}

exports.IngestJobV2 = IngestJobV2;

var _job = new _weakMap.default();

var _uploadStream = new _weakMap.default();

var _downloadStream = new _weakMap.default();

var _dataStream = new _weakMap.default();

var _result = new _weakMap.default();

class JobDataV2 extends _stream.Writable {
  /**
   *
   */
  constructor(options) {
    super({
      objectMode: true
    });

    _job.set(this, {
      writable: true,
      value: void 0
    });

    _uploadStream.set(this, {
      writable: true,
      value: void 0
    });

    _downloadStream.set(this, {
      writable: true,
      value: void 0
    });

    _dataStream.set(this, {
      writable: true,
      value: void 0
    });

    _result.set(this, {
      writable: true,
      value: void 0
    });

    const createRequest = options.createRequest;
    (0, _classPrivateFieldSet2.default)(this, _job, options.job);
    (0, _classPrivateFieldSet2.default)(this, _uploadStream, new _recordStream.Serializable());
    (0, _classPrivateFieldSet2.default)(this, _downloadStream, new _recordStream.Parsable());
    const converterOptions = {
      nullValue: '#N/A'
    };
    const uploadDataStream = (0, _classPrivateFieldGet3.default)(this, _uploadStream).stream('csv', converterOptions);
    const downloadDataStream = (0, _classPrivateFieldGet3.default)(this, _downloadStream).stream('csv', converterOptions);
    (0, _classPrivateFieldSet2.default)(this, _dataStream, (0, _stream2.concatStreamsAsDuplex)(uploadDataStream, downloadDataStream));
    this.on('finish', () => (0, _classPrivateFieldGet3.default)(this, _uploadStream).end());
    uploadDataStream.once('readable', () => {
      try {
        var _classPrivateFieldGet2;

        // pipe upload data to batch API request stream
        const req = createRequest({
          method: 'PUT',
          path: `/${(_classPrivateFieldGet2 = (0, _classPrivateFieldGet3.default)(this, _job).jobInfo) === null || _classPrivateFieldGet2 === void 0 ? void 0 : _classPrivateFieldGet2.id}/batches`,
          headers: {
            'Content-Type': 'text/csv'
          },
          responseType: 'application/json'
        });

        (async () => {
          try {
            const res = await req;
            this.emit('response', res);
          } catch (err) {
            this.emit('error', err);
          }
        })();

        uploadDataStream.pipe(req.stream());
      } catch (err) {
        this.emit('error', err);
      }
    });
  }

  _write(record_, enc, cb) {
    const {
      Id,
      type,
      attributes
    } = record_,
          rrec = (0, _objectWithoutProperties2.default)(record_, ["Id", "type", "attributes"]);
    let record;

    switch ((0, _classPrivateFieldGet3.default)(this, _job).jobInfo.operation) {
      case 'insert':
        record = rrec;
        break;

      case 'delete':
      case 'hardDelete':
        record = {
          Id
        };
        break;

      default:
        record = _objectSpread({
          Id
        }, rrec);
    }

    (0, _classPrivateFieldGet3.default)(this, _uploadStream).write(record, enc, cb);
  }
  /**
   * Returns duplex stream which accepts CSV data input and batch result output
   */


  stream() {
    return (0, _classPrivateFieldGet3.default)(this, _dataStream);
  }
  /**
   * Execute batch operation
   */


  execute(input) {
    if ((0, _classPrivateFieldGet3.default)(this, _result)) {
      throw new Error('Data can only be uploaded to a job once.');
    }

    (0, _classPrivateFieldSet2.default)(this, _result, new _promise.default((resolve, reject) => {
      this.once('response', () => resolve());
      this.once('error', reject);
    }));

    if ((0, _function.isObject)(input) && 'pipe' in input && (0, _function.isFunction)(input.pipe)) {
      // if input has stream.Readable interface
      input.pipe((0, _classPrivateFieldGet3.default)(this, _dataStream));
    } else {
      if ((0, _isArray.default)(input)) {
        for (const record of input) {
          for (const key of (0, _keys.default)(record)) {
            if (typeof record[key] === 'boolean') {
              record[key] = String(record[key]);
            }
          }

          this.write(record);
        }

        this.end();
      } else if (typeof input === 'string') {
        (0, _classPrivateFieldGet3.default)(this, _dataStream).write(input, 'utf8');
        (0, _classPrivateFieldGet3.default)(this, _dataStream).end();
      }
    }

    return this;
  }
  /**
   * Promise/A+ interface
   * Delegate to promise, return promise instance for batch result
   */


  then(onResolved, onReject) {
    if ((0, _classPrivateFieldGet3.default)(this, _result) === undefined) {
      this.execute();
    }

    return (0, _classPrivateFieldGet3.default)(this, _result).then(onResolved, onReject);
  }

}

function getJobIdOrError(jobInfo) {
  const jobId = jobInfo === null || jobInfo === void 0 ? void 0 : jobInfo.id;

  if (jobId === undefined) {
    throw new Error('No job id, maybe you need to call `job.open()` first.');
  }

  return jobId;
}

function delay(ms) {
  return new _promise.default(resolve => (0, _setTimeout2.default)(resolve, ms));
}
/*--------------------------------------------*/

/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */


(0, _jsforce.registerModule)('bulk', conn => new Bulk(conn));
(0, _jsforce.registerModule)('bulk2', conn => new BulkV2(conn));
var _default = Bulk;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvYnVsay50cyJdLCJuYW1lcyI6WyJKb2IiLCJFdmVudEVtaXR0ZXIiLCJjb25zdHJ1Y3RvciIsImJ1bGsiLCJ0eXBlIiwib3BlcmF0aW9uIiwib3B0aW9ucyIsImpvYklkIiwiX2J1bGsiLCJpZCIsInN0YXRlIiwiX2JhdGNoZXMiLCJvbiIsImVycm9yIiwiX2Vycm9yIiwiaW5mbyIsIl9qb2JJbmZvIiwiY2hlY2siLCJvcGVuIiwiRXJyb3IiLCJ0b0xvd2VyQ2FzZSIsImJvZHkiLCJleHRJZEZpZWxkIiwiY29uY3VycmVuY3lNb2RlIiwiYXNzaWdubWVudFJ1bGVJZCIsInJlcyIsIl9yZXF1ZXN0IiwibWV0aG9kIiwicGF0aCIsImhlYWRlcnMiLCJyZXNwb25zZVR5cGUiLCJlbWl0Iiwiam9iSW5mbyIsImVyciIsImNyZWF0ZUJhdGNoIiwiYmF0Y2giLCJCYXRjaCIsImJhdGNoSWQiLCJsb2dnZXIiLCJfbG9nZ2VyIiwicmVhZHkiLCJkZWJ1ZyIsIm9iamVjdCIsInJlc29sdmUiLCJ0aGVuIiwibGlzdCIsImJhdGNoSW5mb0xpc3QiLCJiYXRjaEluZm8iLCJjbG9zZSIsIl9jaGFuZ2VTdGF0ZSIsImFib3J0IiwiUG9sbGluZ1RpbWVvdXRFcnJvciIsIm1lc3NhZ2UiLCJuYW1lIiwiSm9iUG9sbGluZ1RpbWVvdXRFcnJvciIsIldyaXRhYmxlIiwiam9iIiwib2JqZWN0TW9kZSIsImV4ZWN1dGUiLCJjb252ZXJ0ZXJPcHRpb25zIiwibnVsbFZhbHVlIiwidXBsb2FkU3RyZWFtIiwiX3VwbG9hZFN0cmVhbSIsIlNlcmlhbGl6YWJsZSIsInVwbG9hZERhdGFTdHJlYW0iLCJzdHJlYW0iLCJkb3dubG9hZFN0cmVhbSIsIl9kb3dubG9hZFN0cmVhbSIsIlBhcnNhYmxlIiwiZG93bmxvYWREYXRhU3RyZWFtIiwiZW5kIiwib25jZSIsInBpcGUiLCJfY3JlYXRlUmVxdWVzdFN0cmVhbSIsIl9kYXRhU3RyZWFtIiwicmVxIiwiX3dyaXRlIiwicmVjb3JkXyIsImVuYyIsImNiIiwiSWQiLCJhdHRyaWJ1dGVzIiwicnJlYyIsInJlY29yZCIsIndyaXRlIiwiaW5wdXQiLCJfcmVzdWx0IiwicmVqZWN0Iiwia2V5IiwiU3RyaW5nIiwib25SZXNvbHZlZCIsIm9uUmVqZWN0IiwicG9sbCIsImludGVydmFsIiwidGltZW91dCIsInN0YXJ0VGltZSIsIkRhdGUiLCJnZXRUaW1lIiwibm93IiwibnVtYmVyUmVjb3Jkc1Byb2Nlc3NlZCIsInJldHJpZXZlIiwic3RhdGVNZXNzYWdlIiwicmVzcCIsInJlc3VsdHMiLCJyZXN1bHRJZCIsInJlc3VsdCIsInJldCIsInN1Y2Nlc3MiLCJTdWNjZXNzIiwiZXJyb3JzIiwicmVzdWx0U3RyZWFtIiwicmVzdWx0RGF0YVN0cmVhbSIsIkJ1bGtBcGkiLCJIdHRwQXBpIiwiYmVmb3JlU2VuZCIsInJlcXVlc3QiLCJfY29ubiIsImFjY2Vzc1Rva2VuIiwiaXNTZXNzaW9uRXhwaXJlZCIsInJlc3BvbnNlIiwic3RhdHVzQ29kZSIsInRlc3QiLCJoYXNFcnJvckluUmVzcG9uc2VCb2R5IiwicGFyc2VFcnJvciIsImVycm9yQ29kZSIsImV4Y2VwdGlvbkNvZGUiLCJleGNlcHRpb25NZXNzYWdlIiwiQnVsa0FwaVYyIiwiQnVsayIsImNvbm4iLCJyZXF1ZXN0XyIsInJyZXEiLCJiYXNlVXJsIiwiaW5zdGFuY2VVcmwiLCJ2ZXJzaW9uIiwiam9pbiIsInVybCIsImxvYWQiLCJvcHRpb25zT3JJbnB1dCIsImNyZWF0ZUpvYiIsImNsZWFudXAiLCJjbGVhbnVwT25FcnJvciIsInBvbGxJbnRlcnZhbCIsInBvbGxUaW1lb3V0IiwicXVlcnkiLCJzb3FsIiwibSIsInJlcGxhY2UiLCJtYXRjaCIsInJlY29yZFN0cmVhbSIsImRhdGFTdHJlYW0iLCJzdHJlYW1zIiwiQnVsa1YyIiwiY29ubmVjdGlvbiIsIkluZ2VzdEpvYlYyIiwicG9sbGluZ09wdGlvbnMiLCJsb2FkQW5kV2FpdEZvclJlc3VsdHMiLCJ1cGxvYWREYXRhIiwiZ2V0QWxsUmVzdWx0cyIsImRlbGV0ZSIsImNhdGNoIiwiaWdub3JlZCIsInF1ZXJ5Sm9iIiwiUXVlcnlKb2JWMiIsImdldFJlc3VsdHMiLCJjcmVhdGVRdWVyeVJlcXVlc3QiLCJnZXRKb2JJZE9yRXJyb3IiLCJkZWxheSIsInRpbWVvdXRFcnJvciIsIkpvYkRhdGFWMiIsImNyZWF0ZVJlcXVlc3QiLCJjcmVhdGVJbmdlc3RSZXF1ZXN0IiwiZXh0ZXJuYWxJZEZpZWxkTmFtZSIsInN1Y2Nlc3NmdWxSZXN1bHRzIiwiZmFpbGVkUmVzdWx0cyIsInVucHJvY2Vzc2VkUmVjb3JkcyIsImFsbCIsImdldFN1Y2Nlc3NmdWxSZXN1bHRzIiwiZ2V0RmFpbGVkUmVzdWx0cyIsImdldFVucHJvY2Vzc2VkUmVjb3JkcyIsInVuZGVmaW5lZCIsIm1zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFJQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFFQTs7QUFFQTs7QUFRQTs7Ozs7O0FBMExBO0FBQ0E7QUFDQTtBQUNPLE1BQU1BLEdBQU4sU0FHR0Msb0JBSEgsQ0FHZ0I7QUFXckI7QUFDRjtBQUNBO0FBQ0VDLEVBQUFBLFdBQVcsQ0FDVEMsSUFEUyxFQUVUQyxJQUZTLEVBR1RDLFNBSFMsRUFJVEMsT0FKUyxFQUtUQyxLQUxTLEVBTVQ7QUFDQTtBQURBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUVBLFNBQUtDLEtBQUwsR0FBYUwsSUFBYjtBQUNBLFNBQUtDLElBQUwsR0FBWUEsSUFBWjtBQUNBLFNBQUtDLFNBQUwsR0FBaUJBLFNBQWpCO0FBQ0EsU0FBS0MsT0FBTCxHQUFlQSxPQUFPLElBQUksRUFBMUI7QUFDQSxTQUFLRyxFQUFMLEdBQVVGLEtBQVYsYUFBVUEsS0FBVixjQUFVQSxLQUFWLEdBQW1CLElBQW5CO0FBQ0EsU0FBS0csS0FBTCxHQUFhLEtBQUtELEVBQUwsR0FBVSxNQUFWLEdB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QWlCLFFBQXJCLEVBQStCO0FBQ3BDLCtEQUFpQkQsS0FBakIsQ0FBdUJDLEtBQXZCLEVBQThCLE1BQTlCO0FBQ0EsK0RBQWlCZixHQUFqQjtBQUNEO0FBQ0Y7O0FBRUQsV0FBTyxJQUFQO0FBQ0Q7QUFFRDtBQUNGO0FBQ0E7QUFDQTs7O0FBQ0UxQixFQUFBQSxJQUFJLENBQUM4QyxVQUFELEVBQXlCQyxRQUF6QixFQUF1RDtBQUN6RCxRQUFJLHVEQUFpQnlGLFNBQXJCLEVBQWdDO0FBQzlCLFdBQUsxSCxPQUFMO0FBQ0Q7O0FBQ0QsV0FBTyxtREFBY2QsSUFBZCxDQUFtQjhDLFVBQW5CLEVBQStCQyxRQUEvQixDQUFQO0FBQ0Q7O0FBbElnQjs7QUFxSW5CLFNBQVMyRSxlQUFULENBQXlCdEksT0FBekIsRUFBMEU7QUFDeEUsUUFBTXpCLEtBQUssR0FBR3lCLE9BQUgsYUFBR0EsT0FBSCx1QkFBR0EsT0FBTyxDQUFFdkIsRUFBdkI7O0FBQ0EsTUFBSUYsS0FBSyxLQUFLNkssU0FBZCxFQUF5QjtBQUN2QixVQUFNLElBQUlqSyxLQUFKLENBQVUsdURBQVYsQ0FBTjtBQUNEOztBQUNELFNBQU9aLEtBQVA7QUFDRDs7QUFFRCxTQUFTZ0ssS0FBVCxDQUFlYyxFQUFmLEVBQTBDO0FBQ3hDLFNBQU8scUJBQWExSSxPQUFELElBQWEsMEJBQVdBLE9BQVgsRUFBb0IwSSxFQUFwQixDQUF6QixDQUFQO0FBQ0Q7QUFFRDs7QUFDQTtBQUNBO0FBQ0E7OztBQUNBLDZCQUFlLE1BQWYsRUFBd0JwRCxJQUFELElBQVUsSUFBSUQsSUFBSixDQUFTQyxJQUFULENBQWpDO0FBQ0EsNkJBQWUsT0FBZixFQUF5QkEsSUFBRCxJQUFVLElBQUl1QixNQUFKLENBQVd2QixJQUFYLENBQWxDO2VBRWVELEkiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIE1hbmFnZXMgU2FsZXNmb3JjZSBCdWxrIEFQSSByZWxhdGVkIG9wZXJhdGlvbnNcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgRHVwbGV4LCBSZWFkYWJsZSwgV3JpdGFibGUgfSBmcm9tICdzdHJlYW0nO1xuaW1wb3J0IGpvaW5TdHJlYW1zIGZyb20gJ211bHRpc3RyZWFtJztcbmltcG9ydCBDb25uZWN0aW9uIGZyb20gJy4uL2Nvbm5lY3Rpb24nO1xuaW1wb3J0IHsgU2VyaWFsaXphYmxlLCBQYXJzYWJsZSB9IGZyb20gJy4uL3JlY29yZC1zdHJlYW0nO1xuaW1wb3J0IEh0dHBBcGkgZnJvbSAnLi4vaHR0cC1hcGknO1xuaW1wb3J0IHsgU3RyZWFtUHJvbWlzZSB9IGZyb20gJy4uL3V0aWwvcHJvbWlzZSc7XG5pbXBvcnQgeyByZWdpc3Rlck1vZHVsZSB9IGZyb20gJy4uL2pzZm9yY2UnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHsgY29uY2F0U3RyZWFtc0FzRHVwbGV4IH0gZnJvbSAnLi4vdXRpbC9zdHJlYW0nO1xuaW1wb3J0IHtcbiAgSHR0cE1ldGhvZHMsXG4gIEh0dHBSZXF1ZXN0LFxuICBIdHRwUmVzcG9uc2UsXG4gIFJlY29yZCxcbiAgU2NoZW1hLFxufSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBpc0Z1bmN0aW9uLCBpc09iamVjdCB9IGZyb20gJy4uL3V0aWwvZnVuY3Rpb24nO1xuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZXhwb3J0IHR5cGUgQnVsa09wZXJhdGlvbiA9XG4gIHwgJ2luc2VydCdcbiAgfCAndXBkYXRlJ1xuICB8ICd1cHNlcnQnXG4gIHwgJ2RlbGV0ZSdcbiAgfCAnaGFyZERlbGV0ZSdcbiAgfCAncXVlcnknXG4gIHwgJ3F1ZXJ5QWxsJztcblxuZXhwb3J0IHR5cGUgSW5nZXN0T3BlcmF0aW9uID0gRXhjbHVkZTxCdWxrT3BlcmF0aW9uLCAncXVlcnknIHwgJ3F1ZXJ5QWxsJz47XG5cbmV4cG9ydCB0eXBlIFF1ZXJ5T3BlcmF0aW9uID0gRXh0cmFjdDxCdWxrT3BlcmF0aW9uLCAncXVlcnknIHwgJ3F1ZXJ5QWxsJz47XG5cbmV4cG9ydCB0eXBlIEJ1bGtPcHRpb25zID0ge1xuICBleHRJZEZpZWxkPzogc3RyaW5nO1xuICBjb25jdXJyZW5jeU1vZGU/OiAnU2VyaWFsJyB8ICdQYXJhbGxlbCc7XG4gIGFzc2lnbm1lbnRSdWxlSWQ/OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBKb2JTdGF0ZSA9ICdPcGVuJyB8ICdDbG9zZWQnIHwgJ0Fib3J0ZWQnIHwgJ0ZhaWxlZCcgfCAnVW5rbm93bic7XG5cbmV4cG9ydCB0eXBlIEpvYlN0YXRlVjIgPVxuICB8IEV4Y2x1ZGU8Sm9iU3RhdGUsICdDbG9zZWQnIHwgJ1Vua25vd24nPlxuICB8ICdVcGxvYWRDb21wbGV0ZSdcbiAgfCAnSW5Qcm9ncmVzcydcbiAgfCAnSm9iQ29tcGxldGUnO1xuXG5leHBvcnQgdHlwZSBKb2JJbmZvID0ge1xuICBpZDogc3RyaW5nO1xuICBvYmplY3Q6IHN0cmluZztcbiAgb3BlcmF0aW9uOiBCdWxrT3BlcmF0aW9uO1xuICBzdGF0ZTogSm9iU3RhdGU7XG59O1xuXG5leHBvcnQgdHlwZSBKb2JJbmZvVjIgPSB7XG4gIGFwaVZlcnNpb246IHN0cmluZztcbiAgYXNzaWdubWVudFJ1bGVJZD86IHN0cmluZztcbiAgY29sdW1uRGVsaW1pdGVyOlxuICAgIHwgJ0JBQ0tRVU9URSdcbiAgICB8ICdDQVJFVCdcbiAgICB8ICdDT01NQSdcbiAgICB8ICdQSVBFJ1xuICAgIHwgJ1NFTUlDT0xPTidcbiAgICB8ICdUQUInO1xuICBjb25jdXJyZW5jeU1vZGU6ICdQYXJhbGxlbCc7XG4gIGNvbnRlbnRUeXBlOiAnQ1NWJztcbiAgY29udGVudFVybDogc3RyaW5nO1xuICBjcmVhdGVkQnlJZDogc3RyaW5nO1xuICBjcmVhdGVkRGF0ZTogc3RyaW5nO1xuICBleHRlcm5hbElkRmllbGROYW1lPzogc3RyaW5nO1xuICBpZDogc3RyaW5nO1xuICBqb2JUeXBlOiAnQmlnT2JqZWN0SW5nZXN0JyB8ICdDbGFzc2ljJyB8ICdWMkluZ2VzdCc7XG4gIGxpbmVFbmRpbmc6ICdMRicgfCAnQ1JMRic7XG4gIG9iamVjdDogc3RyaW5nO1xuICBvcGVyYXRpb246IEJ1bGtPcGVyYXRpb247XG4gIHN0YXRlOiBKb2JTdGF0ZVYyO1xuICBzeXN0ZW1Nb2RzdGFtcDogc3RyaW5nO1xuICBudW1iZXJSZWNvcmRzUHJvY2Vzc2VkPzogbnVtYmVyO1xuICBudW1iZXJSZWNvcmRzRmFpbGVkPzogbnVtYmVyO1xufTtcblxudHlwZSBKb2JJbmZvUmVzcG9uc2UgPSB7XG4gIGpvYkluZm86IEpvYkluZm87XG59O1xuXG5leHBvcnQgdHlwZSBCYXRjaFN0YXRlID1cbiAgfCAnUXVldWVkJ1xuICB8ICdJblByb2dyZXNzJ1xuICB8ICdDb21wbGV0ZWQnXG4gIHwgJ0ZhaWxlZCdcbiAgfCAnTm90UHJvY2Vzc2VkJztcblxuZXhwb3J0IHR5cGUgQmF0Y2hJbmZvID0ge1xuICBpZDogc3RyaW5nO1xuICBqb2JJZDogc3RyaW5nO1xuICBzdGF0ZTogQmF0Y2hTdGF0ZTtcbiAgc3RhdGVNZXNzYWdlOiBzdHJpbmc7XG4gIG51bWJlclJlY29yZHNQcm9jZXNzZWQ6IHN0cmluZztcbiAgbnVtYmVyUmVjb3Jkc0ZhaWxlZDogc3RyaW5nO1xuICB0b3RhbFByb2Nlc3NpbmdUaW1lOiBzdHJpbmc7XG59O1xuXG50eXBlIEJhdGNoSW5mb1Jlc3BvbnNlID0ge1xuICBiYXRjaEluZm86IEJhdGNoSW5mbztcbn07XG5cbnR5cGUgQmF0Y2hJbmZvTGlzdFJlc3BvbnNlID0ge1xuICBiYXRjaEluZm9MaXN0OiB7XG4gICAgYmF0Y2hJbmZvOiBCYXRjaEluZm8gfCBCYXRjaEluZm9bXTtcbiAgfTtcbn07XG5cbmV4cG9ydCB0eXBlIEJ1bGtRdWVyeUJhdGNoUmVzdWx0ID0gQXJyYXk8e1xuICBpZDogc3RyaW5nO1xuICBiYXRjaElkOiBzdHJpbmc7XG4gIGpvYklkOiBzdHJpbmc7XG59PjtcblxuZXhwb3J0IHR5cGUgQnVsa0luZ2VzdEJhdGNoUmVzdWx0ID0gQXJyYXk8e1xuICBpZDogc3RyaW5nIHwgbnVsbDtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbn0+O1xuXG5leHBvcnQgdHlwZSBCYXRjaFJlc3VsdDxPcHIgZXh0ZW5kcyBCdWxrT3BlcmF0aW9uPiA9IE9wciBleHRlbmRzXG4gIHwgJ3F1ZXJ5J1xuICB8ICdxdWVyeUFsbCdcbiAgPyBCdWxrUXVlcnlCYXRjaFJlc3VsdFxuICA6IEJ1bGtJbmdlc3RCYXRjaFJlc3VsdDtcblxudHlwZSBCdWxrSW5nZXN0UmVzdWx0UmVzcG9uc2UgPSBBcnJheTx7XG4gIElkOiBzdHJpbmc7XG4gIFN1Y2Nlc3M6IHN0cmluZztcbiAgRXJyb3I6IHN0cmluZztcbn0+O1xuXG50eXBlIEJ1bGtRdWVyeVJlc3VsdFJlc3BvbnNlID0ge1xuICAncmVzdWx0LWxpc3QnOiB7XG4gICAgcmVzdWx0OiBzdHJpbmcgfCBzdHJpbmdbXTtcbiAgfTtcbn07XG5cbnR5cGUgQnVsa1JlcXVlc3QgPSB7XG4gIG1ldGhvZDogSHR0cE1ldGhvZHM7XG4gIHBhdGg6IHN0cmluZztcbiAgYm9keT86IHN0cmluZztcbiAgaGVhZGVycz86IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB9O1xuICByZXNwb25zZVR5cGU/OiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBJbmdlc3RKb2JWMlN1Y2Nlc3NmdWxSZXN1bHRzPFMgZXh0ZW5kcyBTY2hlbWE+ID0gQXJyYXk8XG4gIHtcbiAgICBzZl9fQ3JlYXRlZDogJ3RydWUnIHwgJ2ZhbHNlJztcbiAgICBzZl9fSWQ6IHN0cmluZztcbiAgfSAmIFNcbj47XG5cbmV4cG9ydCB0eXBlIEluZ2VzdEpvYlYyRmFpbGVkUmVzdWx0czxTIGV4dGVuZHMgU2NoZW1hPiA9IEFycmF5PFxuICB7XG4gICAgc2ZfX0Vycm9yOiBzdHJpbmc7XG4gICAgc2ZfX0lkOiBzdHJpbmc7XG4gIH0gJiBTXG4+O1xuXG5leHBvcnQgdHlwZSBJbmdlc3RKb2JWMlVucHJvY2Vzc2VkUmVjb3JkczxTIGV4dGVuZHMgU2NoZW1hPiA9IEFycmF5PFM+O1xuXG5leHBvcnQgdHlwZSBJbmdlc3RKb2JWMlJlc3VsdHM8UyBleHRlbmRzIFNjaGVtYT4gPSB7XG4gIHN1Y2Nlc3NmdWxSZXN1bHRzOiBJbmdlc3RKb2JWMlN1Y2Nlc3NmdWxSZXN1bHRzPFM+O1xuICBmYWlsZWRSZXN1bHRzOiBJbmdlc3RKb2JWMkZhaWxlZFJlc3VsdHM8Uz47XG4gIHVucHJvY2Vzc2VkUmVjb3JkczogSW5nZXN0Sm9iVjJVbnByb2Nlc3NlZFJlY29yZHM8Uz47XG59O1xuXG50eXBlIE5ld0luZ2VzdEpvYk9wdGlvbnMgPSBSZXF1aXJlZDxQaWNrPEpvYkluZm9WMiwgJ29iamVjdCcgfCAnb3BlcmF0aW9uJz4+ICZcbiAgUGFydGlhbDxQaWNrPEpvYkluZm9WMiwgJ2Fzc2lnbm1lbnRSdWxlSWQnIHwgJ2V4dGVybmFsSWRGaWVsZE5hbWUnPj47XG5cbnR5cGUgRXhpc3RpbmdJbmdlc3RKb2JPcHRpb25zID0gUGljazxKb2JJbmZvVjIsICdpZCc+O1xuXG50eXBlIENyZWF0ZUluZ2VzdEpvYlYyUmVxdWVzdCA9IDxUPihyZXF1ZXN0OiBCdWxrUmVxdWVzdCkgPT4gU3RyZWFtUHJvbWlzZTxUPjtcblxudHlwZSBDcmVhdGVJbmdlc3RKb2JWMk9wdGlvbnM8UyBleHRlbmRzIFNjaGVtYT4gPSB7XG4gIGNvbm5lY3Rpb246IENvbm5lY3Rpb248Uz47XG4gIGpvYkluZm86IE5ld0luZ2VzdEpvYk9wdGlvbnMgfCBFeGlzdGluZ0luZ2VzdEpvYk9wdGlvbnM7XG4gIHBvbGxpbmdPcHRpb25zOiBCdWxrVjJQb2xsaW5nT3B0aW9ucztcbn07XG5cbnR5cGUgQ3JlYXRlSm9iRGF0YVYyT3B0aW9uczxTIGV4dGVuZHMgU2NoZW1hLCBPcHIgZXh0ZW5kcyBJbmdlc3RPcGVyYXRpb24+ID0ge1xuICBqb2I6IEluZ2VzdEpvYlYyPFMsIE9wcj47XG4gIGNyZWF0ZVJlcXVlc3Q6IENyZWF0ZUluZ2VzdEpvYlYyUmVxdWVzdDtcbn07XG5cbnR5cGUgQ3JlYXRlUXVlcnlKb2JWMk9wdGlvbnM8UyBleHRlbmRzIFNjaGVtYT4gPSB7XG4gIGNvbm5lY3Rpb246IENvbm5lY3Rpb248Uz47XG4gIG9wZXJhdGlvbjogUXVlcnlPcGVyYXRpb247XG4gIHF1ZXJ5OiBzdHJpbmc7XG4gIHBvbGxpbmdPcHRpb25zOiBCdWxrVjJQb2xsaW5nT3B0aW9ucztcbn07XG5cbnR5cGUgQnVsa1YyUG9sbGluZ09wdGlvbnMgPSB7XG4gIHBvbGxJbnRlcnZhbDogbnVtYmVyO1xuICBwb2xsVGltZW91dDogbnVtYmVyO1xufTtcblxuLyoqXG4gKiBDbGFzcyBmb3IgQnVsayBBUEkgSm9iXG4gKi9cbmV4cG9ydCBjbGFzcyBKb2I8XG4gIFMgZXh0ZW5kcyBTY2hlbWEsXG4gIE9wciBleHRlbmRzIEJ1bGtPcGVyYXRpb25cbj4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICB0eXBlOiBzdHJpbmcgfCBudWxsO1xuICBvcGVyYXRpb246IE9wciB8IG51bGw7XG4gIG9wdGlvbnM6IEJ1bGtPcHRpb25zO1xuICBpZDogc3RyaW5nIHwgbnVsbDtcbiAgc3RhdGU6IEpvYlN0YXRlO1xuICBfYnVsazogQnVsazxTPjtcbiAgX2JhdGNoZXM6IHsgW2lkOiBzdHJpbmddOiBCYXRjaDxTLCBPcHI+IH07XG4gIF9qb2JJbmZvOiBQcm9taXNlPEpvYkluZm8+IHwgdW5kZWZpbmVkO1xuICBfZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgYnVsazogQnVsazxTPixcbiAgICB0eXBlOiBzdHJpbmcgfCBudWxsLFxuICAgIG9wZXJhdGlvbjogT3ByIHwgbnVsbCxcbiAgICBvcHRpb25zOiBCdWxrT3B0aW9ucyB8IG51bGwsXG4gICAgam9iSWQ/OiBzdHJpbmcsXG4gICkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fYnVsayA9IGJ1bGs7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm9wZXJhdGlvbiA9IG9wZXJhdGlvbjtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMuaWQgPSBqb2JJZCA/PyBudWxsO1xuICAgIHRoaXMuc3RhdGUgPSB0aGlzLmlkID8gJ09wZW4nIDogJ1Vua25vd24nO1xuICAgIHRoaXMuX2JhdGNoZXMgPSB7fTtcbiAgICAvLyBkZWZhdWx0IGVycm9yIGhhbmRsZXIgdG8ga2VlcCB0aGUgbGF0ZXN0IGVycm9yXG4gICAgdGhpcy5vbignZXJyb3InLCAoZXJyb3IpID0+ICh0aGlzLl9lcnJvciA9IGVycm9yKSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGxhdGVzdCBqb2JJbmZvIGZyb20gY2FjaGVcbiAgICovXG4gIGluZm8oKSB7XG4gICAgLy8gaWYgY2FjaGUgaXMgbm90IGF2YWlsYWJsZSwgY2hlY2sgdGhlIGxhdGVzdFxuICAgIGlmICghdGhpcy5fam9iSW5mbykge1xuICAgICAgdGhpcy5fam9iSW5mbyA9IHRoaXMuY2hlY2soKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2pvYkluZm87XG4gIH1cblxuICAvKipcbiAgICogT3BlbiBuZXcgam9iIGFuZCBnZXQgam9iaW5mb1xuICAgKi9cbiAgb3BlbigpOiBQcm9taXNlPEpvYkluZm8+IHtcbiAgICBjb25zdCBidWxrID0gdGhpcy5fYnVsaztcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuXG4gICAgLy8gaWYgc29iamVjdCB0eXBlIC8gb3BlcmF0aW9uIGlzIG5vdCBwcm92aWRlZFxuICAgIGlmICghdGhpcy50eXBlIHx8ICF0aGlzLm9wZXJhdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd0eXBlIC8gb3BlcmF0aW9uIGlzIHJlcXVpcmVkIHRvIG9wZW4gYSBuZXcgam9iJyk7XG4gICAgfVxuXG4gICAgLy8gaWYgbm90IHJlcXVlc3RlZCBvcGVuaW5nIGpvYlxuICAgIGlmICghdGhpcy5fam9iSW5mbykge1xuICAgICAgbGV0IG9wZXJhdGlvbiA9IHRoaXMub3BlcmF0aW9uLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAob3BlcmF0aW9uID09PSAnaGFyZGRlbGV0ZScpIHtcbiAgICAgICAgb3BlcmF0aW9uID0gJ2hhcmREZWxldGUnO1xuICAgICAgfVxuICAgICAgaWYgKG9wZXJhdGlvbiA9PT0gJ3F1ZXJ5YWxsJykge1xuICAgICAgICBvcGVyYXRpb24gPSAncXVlcnlBbGwnO1xuICAgICAgfVxuICAgICAgY29uc3QgYm9keSA9IGBcbjw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PlxuPGpvYkluZm8gIHhtbG5zPVwiaHR0cDovL3d3dy5mb3JjZS5jb20vMjAwOS8wNi9hc3luY2FwaS9kYXRhbG9hZFwiPlxuICA8b3BlcmF0aW9uPiR7b3BlcmF0aW9ufTwvb3BlcmF0aW9uPlxuICA8b2JqZWN0PiR7dGhpcy50eXBlfTwvb2JqZWN0PlxuICAke1xuICAgIG9wdGlvbnMuZXh0SWRGaWVsZFxuICAgICAgPyBgPGV4dGVybmFsSWRGaWVsZE5hbWU+JHtvcHRpb25zLmV4dElkRmllbGR9PC9leHRlcm5hbElkRmllbGROYW1lPmBcbiAgICAgIDogJydcbiAgfVxuICAke1xuICAgIG9wdGlvbnMuY29uY3VycmVuY3lNb2RlXG4gICAgICA/IGA8Y29uY3VycmVuY3lNb2RlPiR7b3B0aW9ucy5jb25jdXJyZW5jeU1vZGV9PC9jb25jdXJyZW5jeU1vZGU+YFxuICAgICAgOiAnJ1xuICB9XG4gICR7XG4gICAgb3B0aW9ucy5hc3NpZ25tZW50UnVsZUlkXG4gICAgICA/IGA8YXNzaWdubWVudFJ1bGVJZD4ke29wdGlvbnMuYXNzaWdubWVudFJ1bGVJZH08L2Fzc2lnbm1lbnRSdWxlSWQ+YFxuICAgICAgOiAnJ1xuICB9XG4gIDxjb250ZW50VHlwZT5DU1Y8L2NvbnRlbnRUeXBlPlxuPC9qb2JJbmZvPlxuICAgICAgYC50cmltKCk7XG5cbiAgICAgIHRoaXMuX2pvYkluZm8gPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGJ1bGsuX3JlcXVlc3Q8Sm9iSW5mb1Jlc3BvbnNlPih7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIHBhdGg6ICcvam9iJyxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi94bWwnLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuZW1pdCgnb3BlbicsIHJlcy5qb2JJbmZvKTtcbiAgICAgICAgICB0aGlzLmlkID0gcmVzLmpvYkluZm8uaWQ7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IHJlcy5qb2JJbmZvLnN0YXRlO1xuICAgICAgICAgIHJldHVybiByZXMuam9iSW5mbztcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fam9iSW5mbztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgYmF0Y2ggaW5zdGFuY2UgaW4gdGhlIGpvYlxuICAgKi9cbiAgY3JlYXRlQmF0Y2goKTogQmF0Y2g8UywgT3ByPiB7XG4gICAgY29uc3QgYmF0Y2ggPSBuZXcgQmF0Y2godGhpcyk7XG4gICAgYmF0Y2gub24oJ3F1ZXVlJywgKCkgPT4ge1xuICAgICAgdGhpcy5fYmF0Y2hlc1tiYXRjaC5pZCFdID0gYmF0Y2g7XG4gICAgfSk7XG4gICAgcmV0dXJuIGJhdGNoO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIGJhdGNoIGluc3RhbmNlIHNwZWNpZmllZCBieSBnaXZlbiBiYXRjaCBJRFxuICAgKi9cbiAgYmF0Y2goYmF0Y2hJZDogc3RyaW5nKTogQmF0Y2g8UywgT3ByPiB7XG4gICAgbGV0IGJhdGNoID0gdGhpcy5fYmF0Y2hlc1tiYXRjaElkXTtcbiAgICBpZiAoIWJhdGNoKSB7XG4gICAgICBiYXRjaCA9IG5ldyBCYXRjaCh0aGlzLCBiYXRjaElkKTtcbiAgICAgIHRoaXMuX2JhdGNoZXNbYmF0Y2hJZF0gPSBiYXRjaDtcbiAgICB9XG4gICAgcmV0dXJuIGJhdGNoO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBsYXRlc3Qgam9iIHN0YXR1cyBmcm9tIHNlcnZlclxuICAgKi9cbiAgY2hlY2soKSB7XG4gICAgY29uc3QgYnVsayA9IHRoaXMuX2J1bGs7XG4gICAgY29uc3QgbG9nZ2VyID0gYnVsay5fbG9nZ2VyO1xuXG4gICAgdGhpcy5fam9iSW5mbyA9IChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBqb2JJZCA9IGF3YWl0IHRoaXMucmVhZHkoKTtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGJ1bGsuX3JlcXVlc3Q8Sm9iSW5mb1Jlc3BvbnNlPih7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHBhdGg6ICcvam9iLycgKyBqb2JJZCxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXBwbGljYXRpb24veG1sJyxcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmRlYnVnKHJlcy5qb2JJbmZvKTtcbiAgICAgIHRoaXMuaWQgPSByZXMuam9iSW5mby5pZDtcbiAgICAgIHRoaXMudHlwZSA9IHJlcy5qb2JJbmZvLm9iamVjdDtcbiAgICAgIHRoaXMub3BlcmF0aW9uID0gcmVzLmpvYkluZm8ub3BlcmF0aW9uIGFzIE9wcjtcbiAgICAgIHRoaXMuc3RhdGUgPSByZXMuam9iSW5mby5zdGF0ZTtcbiAgICAgIHJldHVybiByZXMuam9iSW5mbztcbiAgICB9KSgpO1xuXG4gICAgcmV0dXJuIHRoaXMuX2pvYkluZm87XG4gIH1cblxuICAvKipcbiAgICogV2FpdCB0aWxsIHRoZSBqb2IgaXMgYXNzaWduZWQgdG8gc2VydmVyXG4gICAqL1xuICByZWFkeSgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLmlkXG4gICAgICA/IFByb21pc2UucmVzb2x2ZSh0aGlzLmlkKVxuICAgICAgOiB0aGlzLm9wZW4oKS50aGVuKCh7IGlkIH0pID0+IGlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0IGFsbCByZWdpc3RlcmVkIGJhdGNoIGluZm8gaW4gam9iXG4gICAqL1xuICBhc3luYyBsaXN0KCkge1xuICAgIGNvbnN0IGJ1bGsgPSB0aGlzLl9idWxrO1xuICAgIGNvbnN0IGxvZ2dlciA9IGJ1bGsuX2xvZ2dlcjtcbiAgICBjb25zdCBqb2JJZCA9IGF3YWl0IHRoaXMucmVhZHkoKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBidWxrLl9yZXF1ZXN0PEJhdGNoSW5mb0xpc3RSZXNwb25zZT4oe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHBhdGg6ICcvam9iLycgKyBqb2JJZCArICcvYmF0Y2gnLFxuICAgICAgcmVzcG9uc2VUeXBlOiAnYXBwbGljYXRpb24veG1sJyxcbiAgICB9KTtcbiAgICBsb2dnZXIuZGVidWcocmVzLmJhdGNoSW5mb0xpc3QuYmF0Y2hJbmZvKTtcbiAgICBjb25zdCBiYXRjaEluZm9MaXN0ID0gQXJyYXkuaXNBcnJheShyZXMuYmF0Y2hJbmZvTGlzdC5iYXRjaEluZm8pXG4gICAgICA/IHJlcy5iYXRjaEluZm9MaXN0LmJhdGNoSW5mb1xuICAgICAgOiBbcmVzLmJhdGNoSW5mb0xpc3QuYmF0Y2hJbmZvXTtcbiAgICByZXR1cm4gYmF0Y2hJbmZvTGlzdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZSBvcGVuZWQgam9iXG4gICAqL1xuICBhc3luYyBjbG9zZSgpIHtcbiAgICBpZiAoIXRoaXMuaWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGpvYkluZm8gPSBhd2FpdCB0aGlzLl9jaGFuZ2VTdGF0ZSgnQ2xvc2VkJyk7XG4gICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgIHRoaXMuZW1pdCgnY2xvc2UnLCBqb2JJbmZvKTtcbiAgICAgIHJldHVybiBqb2JJbmZvO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgc3RhdHVzIHRvIGFib3J0XG4gICAqL1xuICBhc3luYyBhYm9ydCgpIHtcbiAgICBpZiAoIXRoaXMuaWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGpvYkluZm8gPSBhd2FpdCB0aGlzLl9jaGFuZ2VTdGF0ZSgnQWJvcnRlZCcpO1xuICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICB0aGlzLmVtaXQoJ2Fib3J0Jywgam9iSW5mbyk7XG4gICAgICByZXR1cm4gam9iSW5mbztcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX2NoYW5nZVN0YXRlKHN0YXRlOiBKb2JTdGF0ZSkge1xuICAgIGNvbnN0IGJ1bGsgPSB0aGlzLl9idWxrO1xuICAgIGNvbnN0IGxvZ2dlciA9IGJ1bGsuX2xvZ2dlcjtcblxuICAgIHRoaXMuX2pvYkluZm8gPSAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3Qgam9iSWQgPSBhd2FpdCB0aGlzLnJlYWR5KCk7XG4gICAgICBjb25zdCBib2R5ID0gYCBcbjw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PlxuICA8am9iSW5mbyB4bWxucz1cImh0dHA6Ly93d3cuZm9yY2UuY29tLzIwMDkvMDYvYXN5bmNhcGkvZGF0YWxvYWRcIj5cbiAgPHN0YXRlPiR7c3RhdGV9PC9zdGF0ZT5cbjwvam9iSW5mbz5cbiAgICAgIGAudHJpbSgpO1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgYnVsay5fcmVxdWVzdDxKb2JJbmZvUmVzcG9uc2U+KHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIHBhdGg6ICcvam9iLycgKyBqb2JJZCxcbiAgICAgICAgYm9keTogYm9keSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veG1sOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgICAgfSxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXBwbGljYXRpb24veG1sJyxcbiAgICAgIH0pO1xuICAgICAgbG9nZ2VyLmRlYnVnKHJlcy5qb2JJbmZvKTtcbiAgICAgIHRoaXMuc3RhdGUgPSByZXMuam9iSW5mby5zdGF0ZTtcbiAgICAgIHJldHVybiByZXMuam9iSW5mbztcbiAgICB9KSgpO1xuICAgIHJldHVybiB0aGlzLl9qb2JJbmZvO1xuICB9XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuY2xhc3MgUG9sbGluZ1RpbWVvdXRFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgam9iSWQ6IHN0cmluZztcbiAgYmF0Y2hJZDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBqb2JJZDogc3RyaW5nLCBiYXRjaElkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnUG9sbGluZ1RpbWVvdXQnO1xuICAgIHRoaXMuam9iSWQgPSBqb2JJZDtcbiAgICB0aGlzLmJhdGNoSWQgPSBiYXRjaElkO1xuICB9XG59XG5cbmNsYXNzIEpvYlBvbGxpbmdUaW1lb3V0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGpvYklkOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIGpvYklkOiBzdHJpbmcpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSAnSm9iUG9sbGluZ1RpbWVvdXQnO1xuICAgIHRoaXMuam9iSWQgPSBqb2JJZDtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qKlxuICogQmF0Y2ggKGV4dGVuZHMgV3JpdGFibGUpXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXRjaDxcbiAgUyBleHRlbmRzIFNjaGVtYSxcbiAgT3ByIGV4dGVuZHMgQnVsa09wZXJhdGlvblxuPiBleHRlbmRzIFdyaXRhYmxlIHtcbiAgam9iOiBKb2I8UywgT3ByPjtcbiAgaWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgX2J1bGs6IEJ1bGs8Uz47XG4gIF91cGxvYWRTdHJlYW06IFNlcmlhbGl6YWJsZTtcbiAgX2Rvd25sb2FkU3RyZWFtOiBQYXJzYWJsZTtcbiAgX2RhdGFTdHJlYW06IER1cGxleDtcbiAgX3Jlc3VsdDogUHJvbWlzZTxCYXRjaFJlc3VsdDxPcHI+PiB8IHVuZGVmaW5lZDtcbiAgX2Vycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKGpvYjogSm9iPFMsIE9wcj4sIGlkPzogc3RyaW5nKSB7XG4gICAgc3VwZXIoeyBvYmplY3RNb2RlOiB0cnVlIH0pO1xuICAgIHRoaXMuam9iID0gam9iO1xuICAgIHRoaXMuaWQgPSBpZDtcbiAgICB0aGlzLl9idWxrID0gam9iLl9idWxrO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGVyIHRvIGtlZXAgdGhlIGxhdGVzdCBlcnJvclxuICAgIHRoaXMub24oJ2Vycm9yJywgKGVycm9yKSA9PiAodGhpcy5fZXJyb3IgPSBlcnJvcikpO1xuXG4gICAgLy9cbiAgICAvLyBzZXR1cCBkYXRhIHN0cmVhbXNcbiAgICAvL1xuICAgIGNvbnN0IGNvbnZlcnRlck9wdGlvbnMgPSB7IG51bGxWYWx1ZTogJyNOL0EnIH07XG4gICAgY29uc3QgdXBsb2FkU3RyZWFtID0gKHRoaXMuX3VwbG9hZFN0cmVhbSA9IG5ldyBTZXJpYWxpemFibGUoKSk7XG4gICAgY29uc3QgdXBsb2FkRGF0YVN0cmVhbSA9IHVwbG9hZFN0cmVhbS5zdHJlYW0oJ2NzdicsIGNvbnZlcnRlck9wdGlvbnMpO1xuICAgIGNvbnN0IGRvd25sb2FkU3RyZWFtID0gKHRoaXMuX2Rvd25sb2FkU3RyZWFtID0gbmV3IFBhcnNhYmxlKCkpO1xuICAgIGNvbnN0IGRvd25sb2FkRGF0YVN0cmVhbSA9IGRvd25sb2FkU3RyZWFtLnN0cmVhbSgnY3N2JywgY29udmVydGVyT3B0aW9ucyk7XG5cbiAgICB0aGlzLm9uKCdmaW5pc2gnLCAoKSA9PiB1cGxvYWRTdHJlYW0uZW5kKCkpO1xuICAgIHVwbG9hZERhdGFTdHJlYW0ub25jZSgncmVhZGFibGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBlbnN1cmUgdGhlIGpvYiBpcyBvcGVuZWQgaW4gc2VydmVyIG9yIGpvYiBpZCBpcyBhbHJlYWR5IGFzc2lnbmVkXG4gICAgICAgIGF3YWl0IHRoaXMuam9iLnJlYWR5KCk7XG4gICAgICAgIC8vIHBpcGUgdXBsb2FkIGRhdGEgdG8gYmF0Y2ggQVBJIHJlcXVlc3Qgc3RyZWFtXG4gICAgICAgIHVwbG9hZERhdGFTdHJlYW0ucGlwZSh0aGlzLl9jcmVhdGVSZXF1ZXN0U3RyZWFtKCkpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gZHVwbGV4IGRhdGEgc3RyZWFtLCBvcGVuZWQgYWNjZXNzIHRvIEFQSSBwcm9ncmFtbWVycyBieSBCYXRjaCNzdHJlYW0oKVxuICAgIHRoaXMuX2RhdGFTdHJlYW0gPSBjb25jYXRTdHJlYW1zQXNEdXBsZXgoXG4gICAgICB1cGxvYWREYXRhU3RyZWFtLFxuICAgICAgZG93bmxvYWREYXRhU3RyZWFtLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQ29ubmVjdCBiYXRjaCBBUEkgYW5kIGNyZWF0ZSBzdHJlYW0gaW5zdGFuY2Ugb2YgcmVxdWVzdC9yZXNwb25zZVxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NyZWF0ZVJlcXVlc3RTdHJlYW0oKSB7XG4gICAgY29uc3QgYnVsayA9IHRoaXMuX2J1bGs7XG4gICAgY29uc3QgbG9nZ2VyID0gYnVsay5fbG9nZ2VyO1xuICAgIGNvbnN0IHJlcSA9IGJ1bGsuX3JlcXVlc3Q8QmF0Y2hJbmZvUmVzcG9uc2U+KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgcGF0aDogJy9qb2IvJyArIHRoaXMuam9iLmlkICsgJy9iYXRjaCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC9jc3YnLFxuICAgICAgfSxcbiAgICAgIHJlc3BvbnNlVHlwZTogJ2FwcGxpY2F0aW9uL3htbCcsXG4gICAgfSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHJlcTtcbiAgICAgICAgbG9nZ2VyLmRlYnVnKHJlcy5iYXRjaEluZm8pO1xuICAgICAgICB0aGlzLmlkID0gcmVzLmJhdGNoSW5mby5pZDtcbiAgICAgICAgdGhpcy5lbWl0KCdxdWV1ZScsIHJlcy5iYXRjaEluZm8pO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHJlcS5zdHJlYW0oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbXBsZW1lbnRhdGlvbiBvZiBXcml0YWJsZVxuICAgKi9cbiAgX3dyaXRlKHJlY29yZF86IFJlY29yZCwgZW5jOiBzdHJpbmcsIGNiOiAoKSA9PiB2b2lkKSB7XG4gICAgY29uc3QgeyBJZCwgdHlwZSwgYXR0cmlidXRlcywgLi4ucnJlYyB9ID0gcmVjb3JkXztcbiAgICBsZXQgcmVjb3JkO1xuICAgIHN3aXRjaCAodGhpcy5qb2Iub3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICdpbnNlcnQnOlxuICAgICAgICByZWNvcmQgPSBycmVjO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICBjYXNlICdoYXJkRGVsZXRlJzpcbiAgICAgICAgcmVjb3JkID0geyBJZCB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJlY29yZCA9IHsgSWQsIC4uLnJyZWMgfTtcbiAgICB9XG4gICAgdGhpcy5fdXBsb2FkU3RyZWFtLndyaXRlKHJlY29yZCwgZW5jLCBjYik7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBkdXBsZXggc3RyZWFtIHdoaWNoIGFjY2VwdHMgQ1NWIGRhdGEgaW5wdXQgYW5kIGJhdGNoIHJlc3VsdCBvdXRwdXRcbiAgICovXG4gIHN0cmVhbSgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGF0YVN0cmVhbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGJhdGNoIG9wZXJhdGlvblxuICAgKi9cbiAgZXhlY3V0ZShpbnB1dD86IHN0cmluZyB8IFJlY29yZFtdIHwgUmVhZGFibGUpIHtcbiAgICAvLyBpZiBiYXRjaCBpcyBhbHJlYWR5IGV4ZWN1dGVkXG4gICAgaWYgKHRoaXMuX3Jlc3VsdCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXRjaCBhbHJlYWR5IGV4ZWN1dGVkLicpO1xuICAgIH1cblxuICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMub25jZSgncmVzcG9uc2UnLCByZXNvbHZlKTtcbiAgICAgIHRoaXMub25jZSgnZXJyb3InLCByZWplY3QpO1xuICAgIH0pO1xuXG4gICAgaWYgKGlzT2JqZWN0KGlucHV0KSAmJiAncGlwZScgaW4gaW5wdXQgJiYgaXNGdW5jdGlvbihpbnB1dC5waXBlKSkge1xuICAgICAgLy8gaWYgaW5wdXQgaGFzIHN0cmVhbS5SZWFkYWJsZSBpbnRlcmZhY2VcbiAgICAgIGlucHV0LnBpcGUodGhpcy5fZGF0YVN0cmVhbSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGlucHV0KSkge1xuICAgICAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiBpbnB1dCkge1xuICAgICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHJlY29yZCkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmVjb3JkW2tleV0gPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICByZWNvcmRba2V5XSA9IFN0cmluZyhyZWNvcmRba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMud3JpdGUocmVjb3JkKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVuZCgpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2RhdGFTdHJlYW0ud3JpdGUoaW5wdXQsICd1dGY4Jyk7XG4gICAgICAgIHRoaXMuX2RhdGFTdHJlYW0uZW5kKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIEJhdGNoIGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcnVuID0gdGhpcy5leGVjdXRlO1xuXG4gIGV4ZWMgPSB0aGlzLmV4ZWN1dGU7XG5cbiAgLyoqXG4gICAqIFByb21pc2UvQSsgaW50ZXJmYWNlXG4gICAqIERlbGVnYXRlIHRvIHByb21pc2UsIHJldHVybiBwcm9taXNlIGluc3RhbmNlIGZvciBiYXRjaCByZXN1bHRcbiAgICovXG4gIHRoZW4oXG4gICAgb25SZXNvbHZlZDogKHJlczogQmF0Y2hSZXN1bHQ8T3ByPikgPT4gdm9pZCxcbiAgICBvblJlamVjdDogKGVycjogYW55KSA9PiB2b2lkLFxuICApIHtcbiAgICBpZiAoIXRoaXMuX3Jlc3VsdCkge1xuICAgICAgdGhpcy5leGVjdXRlKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9yZXN1bHQhLnRoZW4ob25SZXNvbHZlZCwgb25SZWplY3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBsYXRlc3QgYmF0Y2ggc3RhdHVzIGluIHNlcnZlclxuICAgKi9cbiAgYXN5bmMgY2hlY2soKSB7XG4gICAgY29uc3QgYnVsayA9IHRoaXMuX2J1bGs7XG4gICAgY29uc3QgbG9nZ2VyID0gYnVsay5fbG9nZ2VyO1xuICAgIGNvbnN0IGpvYklkID0gdGhpcy5qb2IuaWQ7XG4gICAgY29uc3QgYmF0Y2hJZCA9IHRoaXMuaWQ7XG5cbiAgICBpZiAoIWpvYklkIHx8ICFiYXRjaElkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JhdGNoIG5vdCBzdGFydGVkLicpO1xuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBidWxrLl9yZXF1ZXN0PEJhdGNoSW5mb1Jlc3BvbnNlPih7XG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgcGF0aDogJy9qb2IvJyArIGpvYklkICsgJy9iYXRjaC8nICsgYmF0Y2hJZCxcbiAgICAgIHJlc3BvbnNlVHlwZTogJ2FwcGxpY2F0aW9uL3htbCcsXG4gICAgfSk7XG4gICAgbG9nZ2VyLmRlYnVnKHJlcy5iYXRjaEluZm8pO1xuICAgIHJldHVybiByZXMuYmF0Y2hJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIFBvbGxpbmcgdGhlIGJhdGNoIHJlc3VsdCBhbmQgcmV0cmlldmVcbiAgICovXG4gIHBvbGwoaW50ZXJ2YWw6IG51bWJlciwgdGltZW91dDogbnVtYmVyKSB7XG4gICAgY29uc3Qgam9iSWQgPSB0aGlzLmpvYi5pZDtcbiAgICBjb25zdCBiYXRjaElkID0gdGhpcy5pZDtcblxuICAgIGlmICgham9iSWQgfHwgIWJhdGNoSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQmF0Y2ggbm90IHN0YXJ0ZWQuJyk7XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIGNvbnN0IHBvbGwgPSBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgIGlmIChzdGFydFRpbWUgKyB0aW1lb3V0IDwgbm93KSB7XG4gICAgICAgIGNvbnN0IGVyciA9IG5ldyBQb2xsaW5nVGltZW91dEVycm9yKFxuICAgICAgICAgICdQb2xsaW5nIHRpbWUgb3V0LiBKb2IgSWQgPSAnICsgam9iSWQgKyAnICwgYmF0Y2ggSWQgPSAnICsgYmF0Y2hJZCxcbiAgICAgICAgICBqb2JJZCxcbiAgICAgICAgICBiYXRjaElkLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbGV0IHJlcztcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlcyA9IGF3YWl0IHRoaXMuY2hlY2soKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHJlcy5zdGF0ZSA9PT0gJ0ZhaWxlZCcpIHtcbiAgICAgICAgaWYgKHBhcnNlSW50KHJlcy5udW1iZXJSZWNvcmRzUHJvY2Vzc2VkLCAxMCkgPiAwKSB7XG4gICAgICAgICAgdGhpcy5yZXRyaWV2ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IocmVzLnN0YXRlTWVzc2FnZSkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHJlcy5zdGF0ZSA9PT0gJ0NvbXBsZXRlZCcpIHtcbiAgICAgICAgdGhpcy5yZXRyaWV2ZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5lbWl0KCdwcm9ncmVzcycsIHJlcyk7XG4gICAgICAgIHNldFRpbWVvdXQocG9sbCwgaW50ZXJ2YWwpO1xuICAgICAgfVxuICAgIH07XG4gICAgc2V0VGltZW91dChwb2xsLCBpbnRlcnZhbCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgYmF0Y2ggcmVzdWx0XG4gICAqL1xuICBhc3luYyByZXRyaWV2ZSgpIHtcbiAgICBjb25zdCBidWxrID0gdGhpcy5fYnVsaztcbiAgICBjb25zdCBqb2JJZCA9IHRoaXMuam9iLmlkO1xuICAgIGNvbnN0IGpvYiA9IHRoaXMuam9iO1xuICAgIGNvbnN0IGJhdGNoSWQgPSB0aGlzLmlkO1xuXG4gICAgaWYgKCFqb2JJZCB8fCAhYmF0Y2hJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXRjaCBub3Qgc3RhcnRlZC4nKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcCA9IGF3YWl0IGJ1bGsuX3JlcXVlc3Q8XG4gICAgICAgIEJ1bGtJbmdlc3RSZXN1bHRSZXNwb25zZSB8IEJ1bGtRdWVyeVJlc3VsdFJlc3BvbnNlXG4gICAgICA+KHtcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgcGF0aDogJy9qb2IvJyArIGpvYklkICsgJy9iYXRjaC8nICsgYmF0Y2hJZCArICcvcmVzdWx0JyxcbiAgICAgIH0pO1xuICAgICAgbGV0IHJlc3VsdHM6IEJ1bGtJbmdlc3RCYXRjaFJlc3VsdCB8IEJ1bGtRdWVyeUJhdGNoUmVzdWx0O1xuICAgICAgaWYgKGpvYi5vcGVyYXRpb24gPT09ICdxdWVyeScgfHwgam9iLm9wZXJhdGlvbiA9PT0gJ3F1ZXJ5QWxsJykge1xuICAgICAgICBjb25zdCByZXMgPSByZXNwIGFzIEJ1bGtRdWVyeVJlc3VsdFJlc3BvbnNlO1xuICAgICAgICBsZXQgcmVzdWx0SWQgPSByZXNbJ3Jlc3VsdC1saXN0J10ucmVzdWx0O1xuICAgICAgICByZXN1bHRzID0gKEFycmF5LmlzQXJyYXkocmVzdWx0SWQpXG4gICAgICAgICAgPyByZXN1bHRJZFxuICAgICAgICAgIDogW3Jlc3VsdElkXVxuICAgICAgICApLm1hcCgoaWQpID0+ICh7IGlkLCBiYXRjaElkLCBqb2JJZCB9KSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXMgPSByZXNwIGFzIEJ1bGtJbmdlc3RSZXN1bHRSZXNwb25zZTtcbiAgICAgICAgcmVzdWx0cyA9IHJlcy5tYXAoKHJldCkgPT4gKHtcbiAgICAgICAgICBpZDogcmV0LklkIHx8IG51bGwsXG4gICAgICAgICAgc3VjY2VzczogcmV0LlN1Y2Nlc3MgPT09ICd0cnVlJyxcbiAgICAgICAgICBlcnJvcnM6IHJldC5FcnJvciA/IFtyZXQuRXJyb3JdIDogW10sXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZW1pdCgncmVzcG9uc2UnLCByZXN1bHRzKTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZldGNoIHF1ZXJ5IHJlc3VsdCBhcyBhIHJlY29yZCBzdHJlYW1cbiAgICogQHBhcmFtIHtTdHJpbmd9IHJlc3VsdElkIC0gUmVzdWx0IGlkXG4gICAqIEByZXR1cm5zIHtSZWNvcmRTdHJlYW19IC0gUmVjb3JkIHN0cmVhbSwgY29udmVydGlibGUgdG8gQ1NWIGRhdGEgc3RyZWFtXG4gICAqL1xuICByZXN1bHQocmVzdWx0SWQ6IHN0cmluZykge1xuICAgIGNvbnN0IGpvYklkID0gdGhpcy5qb2IuaWQ7XG4gICAgY29uc3QgYmF0Y2hJZCA9IHRoaXMuaWQ7XG4gICAgaWYgKCFqb2JJZCB8fCAhYmF0Y2hJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXRjaCBub3Qgc3RhcnRlZC4nKTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0U3RyZWFtID0gbmV3IFBhcnNhYmxlKCk7XG4gICAgY29uc3QgcmVzdWx0RGF0YVN0cmVhbSA9IHJlc3VsdFN0cmVhbS5zdHJlYW0oJ2NzdicpO1xuICAgIHRoaXMuX2J1bGtcbiAgICAgIC5fcmVxdWVzdCh7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHBhdGg6ICcvam9iLycgKyBqb2JJZCArICcvYmF0Y2gvJyArIGJhdGNoSWQgKyAnL3Jlc3VsdC8nICsgcmVzdWx0SWQsXG4gICAgICAgIHJlc3BvbnNlVHlwZTogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICB9KVxuICAgICAgLnN0cmVhbSgpXG4gICAgICAucGlwZShyZXN1bHREYXRhU3RyZWFtKTtcbiAgICByZXR1cm4gcmVzdWx0U3RyZWFtO1xuICB9XG59XG5cbi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLyoqXG4gKlxuICovXG5jbGFzcyBCdWxrQXBpPFMgZXh0ZW5kcyBTY2hlbWE+IGV4dGVuZHMgSHR0cEFwaTxTPiB7XG4gIGJlZm9yZVNlbmQocmVxdWVzdDogSHR0cFJlcXVlc3QpIHtcbiAgICByZXF1ZXN0LmhlYWRlcnMgPSB7XG4gICAgICAuLi5yZXF1ZXN0LmhlYWRlcnMsXG4gICAgICAnWC1TRkRDLVNFU1NJT04nOiB0aGlzLl9jb25uLmFjY2Vzc1Rva2VuID8/ICcnLFxuICAgIH07XG4gIH1cblxuICBpc1Nlc3Npb25FeHBpcmVkKHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UpIHtcbiAgICByZXR1cm4gKFxuICAgICAgcmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gNDAwICYmXG4gICAgICAvPGV4Y2VwdGlvbkNvZGU+SW52YWxpZFNlc3Npb25JZDxcXC9leGNlcHRpb25Db2RlPi8udGVzdChyZXNwb25zZS5ib2R5KVxuICAgICk7XG4gIH1cblxuICBoYXNFcnJvckluUmVzcG9uc2VCb2R5KGJvZHk6IGFueSkge1xuICAgIHJldHVybiAhIWJvZHkuZXJyb3I7XG4gIH1cblxuICBwYXJzZUVycm9yKGJvZHk6IGFueSkge1xuICAgIHJldHVybiB7XG4gICAgICBlcnJvckNvZGU6IGJvZHkuZXJyb3IuZXhjZXB0aW9uQ29kZSxcbiAgICAgIG1lc3NhZ2U6IGJvZHkuZXJyb3IuZXhjZXB0aW9uTWVzc2FnZSxcbiAgICB9O1xuICB9XG59XG5cbmNsYXNzIEJ1bGtBcGlWMjxTIGV4dGVuZHMgU2NoZW1hPiBleHRlbmRzIEh0dHBBcGk8Uz4ge1xuICBoYXNFcnJvckluUmVzcG9uc2VCb2R5KGJvZHk6IGFueSkge1xuICAgIHJldHVybiAoXG4gICAgICBBcnJheS5pc0FycmF5KGJvZHkpICYmXG4gICAgICB0eXBlb2YgYm9keVswXSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICdlcnJvckNvZGUnIGluIGJvZHlbMF1cbiAgICApO1xuICB9XG5cbiAgaXNTZXNzaW9uRXhwaXJlZChyZXNwb25zZTogSHR0cFJlc3BvbnNlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDQwMSAmJiAvSU5WQUxJRF9TRVNTSU9OX0lELy50ZXN0KHJlc3BvbnNlLmJvZHkpXG4gICAgKTtcbiAgfVxuXG4gIHBhcnNlRXJyb3IoYm9keTogYW55KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yQ29kZTogYm9keVswXS5lcnJvckNvZGUsXG4gICAgICBtZXNzYWdlOiBib2R5WzBdLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLyoqXG4gKiBDbGFzcyBmb3IgQnVsayBBUElcbiAqXG4gKiBAY2xhc3NcbiAqL1xuZXhwb3J0IGNsYXNzIEJ1bGs8UyBleHRlbmRzIFNjaGVtYT4ge1xuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcbiAgX2xvZ2dlcjogTG9nZ2VyO1xuXG4gIC8qKlxuICAgKiBQb2xsaW5nIGludGVydmFsIGluIG1pbGxpc2Vjb25kc1xuICAgKi9cbiAgcG9sbEludGVydmFsID0gMTAwMDtcblxuICAvKipcbiAgICogUG9sbGluZyB0aW1lb3V0IGluIG1pbGxpc2Vjb25kc1xuICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgKi9cbiAgcG9sbFRpbWVvdXQgPSAxMDAwMDtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbm46IENvbm5lY3Rpb248Uz4pIHtcbiAgICB0aGlzLl9jb25uID0gY29ubjtcbiAgICB0aGlzLl9sb2dnZXIgPSBjb25uLl9sb2dnZXI7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIF9yZXF1ZXN0PFQ+KHJlcXVlc3RfOiBCdWxrUmVxdWVzdCkge1xuICAgIGNvbnN0IGNvbm4gPSB0aGlzLl9jb25uO1xuICAgIGNvbnN0IHsgcGF0aCwgcmVzcG9uc2VUeXBlLCAuLi5ycmVxIH0gPSByZXF1ZXN0XztcbiAgICBjb25zdCBiYXNlVXJsID0gW2Nvbm4uaW5zdGFuY2VVcmwsICdzZXJ2aWNlcy9hc3luYycsIGNvbm4udmVyc2lvbl0uam9pbihcbiAgICAgICcvJyxcbiAgICApO1xuICAgIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgICAuLi5ycmVxLFxuICAgICAgdXJsOiBiYXNlVXJsICsgcGF0aCxcbiAgICB9O1xuICAgIHJldHVybiBuZXcgQnVsa0FwaSh0aGlzLl9jb25uLCB7IHJlc3BvbnNlVHlwZSB9KS5yZXF1ZXN0PFQ+KHJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbmQgc3RhcnQgYnVsa2xvYWQgam9iIGFuZCBiYXRjaFxuICAgKi9cbiAgbG9hZDxPcHIgZXh0ZW5kcyBCdWxrT3BlcmF0aW9uPihcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgb3BlcmF0aW9uOiBPcHIsXG4gICAgaW5wdXQ/OiBSZWNvcmRbXSB8IFJlYWRhYmxlIHwgc3RyaW5nLFxuICApOiBCYXRjaDxTLCBPcHI+O1xuICBsb2FkPE9wciBleHRlbmRzIEJ1bGtPcGVyYXRpb24+KFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBvcGVyYXRpb246IE9wcixcbiAgICBvcHRpb25zT3JJbnB1dD86IEJ1bGtPcHRpb25zIHwgUmVjb3JkW10gfCBSZWFkYWJsZSB8IHN0cmluZyxcbiAgICBpbnB1dD86IFJlY29yZFtdIHwgUmVhZGFibGUgfCBzdHJpbmcsXG4gICk6IEJhdGNoPFMsIE9wcj47XG4gIGxvYWQ8T3ByIGV4dGVuZHMgQnVsa09wZXJhdGlvbj4oXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIG9wZXJhdGlvbjogT3ByLFxuICAgIG9wdGlvbnNPcklucHV0PzogQnVsa09wdGlvbnMgfCBSZWNvcmRbXSB8IFJlYWRhYmxlIHwgc3RyaW5nLFxuICAgIGlucHV0PzogUmVjb3JkW10gfCBSZWFkYWJsZSB8IHN0cmluZyxcbiAgKSB7XG4gICAgbGV0IG9wdGlvbnM6IEJ1bGtPcHRpb25zID0ge307XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG9wdGlvbnNPcklucHV0ID09PSAnc3RyaW5nJyB8fFxuICAgICAgQXJyYXkuaXNBcnJheShvcHRpb25zT3JJbnB1dCkgfHxcbiAgICAgIChpc09iamVjdChvcHRpb25zT3JJbnB1dCkgJiZcbiAgICAgICAgJ3BpcGUnIGluIG9wdGlvbnNPcklucHV0ICYmXG4gICAgICAgIHR5cGVvZiBvcHRpb25zT3JJbnB1dC5waXBlID09PSAnZnVuY3Rpb24nKVxuICAgICkge1xuICAgICAgLy8gd2hlbiBvcHRpb25zIGlzIG5vdCBwbGFpbiBoYXNoIG9iamVjdCwgaXQgaXMgb21pdHRlZFxuICAgICAgaW5wdXQgPSBvcHRpb25zT3JJbnB1dDtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnNPcklucHV0IGFzIEJ1bGtPcHRpb25zO1xuICAgIH1cbiAgICBjb25zdCBqb2IgPSB0aGlzLmNyZWF0ZUpvYih0eXBlLCBvcGVyYXRpb24sIG9wdGlvbnMpO1xuICAgIGNvbnN0IGJhdGNoID0gam9iLmNyZWF0ZUJhdGNoKCk7XG4gICAgY29uc3QgY2xlYW51cCA9ICgpID0+IGpvYi5jbG9zZSgpO1xuICAgIGNvbnN0IGNsZWFudXBPbkVycm9yID0gKGVycjogRXJyb3IpID0+IHtcbiAgICAgIGlmIChlcnIubmFtZSAhPT0gJ1BvbGxpbmdUaW1lb3V0Jykge1xuICAgICAgICBjbGVhbnVwKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBiYXRjaC5vbigncmVzcG9uc2UnLCBjbGVhbnVwKTtcbiAgICBiYXRjaC5vbignZXJyb3InLCBjbGVhbnVwT25FcnJvcik7XG4gICAgYmF0Y2gub24oJ3F1ZXVlJywgKCkgPT4ge1xuICAgICAgYmF0Y2g/LnBvbGwodGhpcy5wb2xsSW50ZXJ2YWwsIHRoaXMucG9sbFRpbWVvdXQpO1xuICAgIH0pO1xuICAgIHJldHVybiBiYXRjaC5leGVjdXRlKGlucHV0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGJ1bGsgcXVlcnkgYW5kIGdldCByZWNvcmQgc3RyZWFtXG4gICAqL1xuICBxdWVyeShzb3FsOiBzdHJpbmcpIHtcbiAgICBjb25zdCBtID0gc29xbC5yZXBsYWNlKC9cXChbXFxzXFxTXStcXCkvZywgJycpLm1hdGNoKC9GUk9NXFxzKyhcXHcrKS9pKTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ05vIHNvYmplY3QgdHlwZSBmb3VuZCBpbiBxdWVyeSwgbWF5YmUgY2F1c2VkIGJ5IGludmFsaWQgU09RTC4nLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgdHlwZSA9IG1bMV07XG4gICAgY29uc3QgcmVjb3JkU3RyZWFtID0gbmV3IFBhcnNhYmxlKCk7XG4gICAgY29uc3QgZGF0YVN0cmVhbSA9IHJlY29yZFN0cmVhbS5zdHJlYW0oJ2NzdicpO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5sb2FkKHR5cGUsICdxdWVyeScsIHNvcWwpO1xuICAgICAgICBjb25zdCBzdHJlYW1zID0gcmVzdWx0cy5tYXAoKHJlc3VsdCkgPT5cbiAgICAgICAgICB0aGlzLmpvYihyZXN1bHQuam9iSWQpXG4gICAgICAgICAgICAuYmF0Y2gocmVzdWx0LmJhdGNoSWQpXG4gICAgICAgICAgICAucmVzdWx0KHJlc3VsdC5pZClcbiAgICAgICAgICAgIC5zdHJlYW0oKSxcbiAgICAgICAgKTtcbiAgICAgICAgam9pblN0cmVhbXMoc3RyZWFtcykucGlwZShkYXRhU3RyZWFtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICByZWNvcmRTdHJlYW0uZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuIHJlY29yZFN0cmVhbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgam9iIGluc3RhbmNlXG4gICAqL1xuICBjcmVhdGVKb2I8T3ByIGV4dGVuZHMgQnVsa09wZXJhdGlvbj4oXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIG9wZXJhdGlvbjogT3ByLFxuICAgIG9wdGlvbnM6IEJ1bGtPcHRpb25zID0ge30sXG4gICkge1xuICAgIHJldHVybiBuZXcgSm9iKHRoaXMsIHR5cGUsIG9wZXJhdGlvbiwgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgam9iIGluc3RhbmNlIHNwZWNpZmllZCBieSBnaXZlbiBqb2IgSURcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGpvYklkIC0gSm9iIElEXG4gICAqIEByZXR1cm5zIHtCdWxrfkpvYn1cbiAgICovXG4gIGpvYjxPcHIgZXh0ZW5kcyBCdWxrT3BlcmF0aW9uPihqb2JJZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBKb2I8UywgT3ByPih0aGlzLCBudWxsLCBudWxsLCBudWxsLCBqb2JJZCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtWMjxTIGV4dGVuZHMgU2NoZW1hPiB7XG4gICNjb25uZWN0aW9uOiBDb25uZWN0aW9uPFM+O1xuXG4gIC8qKlxuICAgKiBQb2xsaW5nIGludGVydmFsIGluIG1pbGxpc2Vjb25kc1xuICAgKi9cbiAgcG9sbEludGVydmFsID0gMTAwMDtcblxuICAvKipcbiAgICogUG9sbGluZyB0aW1lb3V0IGluIG1pbGxpc2Vjb25kc1xuICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgKi9cbiAgcG9sbFRpbWVvdXQgPSAxMDAwMDtcblxuICBjb25zdHJ1Y3Rvcihjb25uZWN0aW9uOiBDb25uZWN0aW9uPFM+KSB7XG4gICAgdGhpcy4jY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGpvYiBpbnN0YW5jZVxuICAgKi9cbiAgY3JlYXRlSm9iPE9wciBleHRlbmRzIEluZ2VzdE9wZXJhdGlvbj4oXG4gICAgb3B0aW9uczogTmV3SW5nZXN0Sm9iT3B0aW9ucyxcbiAgKTogSW5nZXN0Sm9iVjI8UywgT3ByPiB7XG4gICAgcmV0dXJuIG5ldyBJbmdlc3RKb2JWMih7XG4gICAgICBjb25uZWN0aW9uOiB0aGlzLiNjb25uZWN0aW9uLFxuICAgICAgam9iSW5mbzogb3B0aW9ucyxcbiAgICAgIHBvbGxpbmdPcHRpb25zOiB0aGlzLFxuICAgIH0pO1xuICB9XG5cbiAgam9iPE9wciBleHRlbmRzIEluZ2VzdE9wZXJhdGlvbj4oXG4gICAgb3B0aW9uczogRXhpc3RpbmdJbmdlc3RKb2JPcHRpb25zLFxuICApOiBJbmdlc3RKb2JWMjxTLCBPcHI+IHtcbiAgICByZXR1cm4gbmV3IEluZ2VzdEpvYlYyKHtcbiAgICAgIGNvbm5lY3Rpb246IHRoaXMuI2Nvbm5lY3Rpb24sXG4gICAgICBqb2JJbmZvOiBvcHRpb25zLFxuICAgICAgcG9sbGluZ09wdGlvbnM6IHRoaXMsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlLCB1cGxvYWQsIGFuZCBzdGFydCBidWxrbG9hZCBqb2JcbiAgICovXG4gIGFzeW5jIGxvYWRBbmRXYWl0Rm9yUmVzdWx0cyhcbiAgICBvcHRpb25zOiBOZXdJbmdlc3RKb2JPcHRpb25zICZcbiAgICAgIFBhcnRpYWw8QnVsa1YyUG9sbGluZ09wdGlvbnM+ICYge1xuICAgICAgICBpbnB1dDogUmVjb3JkW10gfCBSZWFkYWJsZSB8IHN0cmluZztcbiAgICAgIH0sXG4gICk6IFByb21pc2U8SW5nZXN0Sm9iVjJSZXN1bHRzPFM+PiB7XG4gICAgY29uc3Qgam9iID0gdGhpcy5jcmVhdGVKb2Iob3B0aW9ucyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGpvYi5vcGVuKCk7XG4gICAgICBhd2FpdCBqb2IudXBsb2FkRGF0YShvcHRpb25zLmlucHV0KTtcbiAgICAgIGF3YWl0IGpvYi5jbG9zZSgpO1xuICAgICAgYXdhaXQgam9iLnBvbGwob3B0aW9ucy5wb2xsSW50ZXJ2YWwsIG9wdGlvbnMucG9sbFRpbWVvdXQpO1xuICAgICAgcmV0dXJuIGF3YWl0IGpvYi5nZXRBbGxSZXN1bHRzKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyLm5hbWUgIT09ICdKb2JQb2xsaW5nVGltZW91dEVycm9yJykge1xuICAgICAgICAvLyBmaXJlcyBvZmYgb25lIGxhc3QgYXR0ZW1wdCB0byBjbGVhbiB1cCBhbmQgaWdub3JlcyB0aGUgcmVzdWx0IHwgZXJyb3JcbiAgICAgICAgam9iLmRlbGV0ZSgpLmNhdGNoKChpZ25vcmVkKSA9PiBpZ25vcmVkKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBidWxrIHF1ZXJ5IGFuZCBnZXQgcmVjb3JkIHN0cmVhbVxuICAgKi9cbiAgYXN5bmMgcXVlcnkoXG4gICAgc29xbDogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPEJ1bGtWMlBvbGxpbmdPcHRpb25zPixcbiAgKTogUHJvbWlzZTxSZWNvcmRbXT4ge1xuICAgIGNvbnN0IHF1ZXJ5Sm9iID0gbmV3IFF1ZXJ5Sm9iVjIoe1xuICAgICAgY29ubmVjdGlvbjogdGhpcy4jY29ubmVjdGlvbixcbiAgICAgIG9wZXJhdGlvbjogJ3F1ZXJ5JyxcbiAgICAgIHF1ZXJ5OiBzb3FsLFxuICAgICAgcG9sbGluZ09wdGlvbnM6IHRoaXMsXG4gICAgfSk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHF1ZXJ5Sm9iLm9wZW4oKTtcbiAgICAgIGF3YWl0IHF1ZXJ5Sm9iLnBvbGwob3B0aW9ucz8ucG9sbEludGVydmFsLCBvcHRpb25zPy5wb2xsVGltZW91dCk7XG4gICAgICByZXR1cm4gYXdhaXQgcXVlcnlKb2IuZ2V0UmVzdWx0cygpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyci5uYW1lICE9PSAnSm9iUG9sbGluZ1RpbWVvdXRFcnJvcicpIHtcbiAgICAgICAgLy8gZmlyZXMgb2ZmIG9uZSBsYXN0IGF0dGVtcHQgdG8gY2xlYW4gdXAgYW5kIGlnbm9yZXMgdGhlIHJlc3VsdCB8IGVycm9yXG4gICAgICAgIHF1ZXJ5Sm9iLmRlbGV0ZSgpLmNhdGNoKChpZ25vcmVkKSA9PiBpZ25vcmVkKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1ZXJ5Sm9iVjI8UyBleHRlbmRzIFNjaGVtYT4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICByZWFkb25seSAjY29ubmVjdGlvbjogQ29ubmVjdGlvbjxTPjtcbiAgcmVhZG9ubHkgI29wZXJhdGlvbjogUXVlcnlPcGVyYXRpb247XG4gIHJlYWRvbmx5ICNxdWVyeTogc3RyaW5nO1xuICByZWFkb25seSAjcG9sbGluZ09wdGlvbnM6IEJ1bGtWMlBvbGxpbmdPcHRpb25zO1xuICAjcXVlcnlSZXN1bHRzOiBSZWNvcmRbXSB8IHVuZGVmaW5lZDtcbiAgI2Vycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcbiAgam9iSW5mbzogUGFydGlhbDxKb2JJbmZvVjI+IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENyZWF0ZVF1ZXJ5Sm9iVjJPcHRpb25zPFM+KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLiNjb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIHRoaXMuI29wZXJhdGlvbiA9IG9wdGlvbnMub3BlcmF0aW9uO1xuICAgIHRoaXMuI3F1ZXJ5ID0gb3B0aW9ucy5xdWVyeTtcbiAgICB0aGlzLiNwb2xsaW5nT3B0aW9ucyA9IG9wdGlvbnMucG9sbGluZ09wdGlvbnM7XG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGVyIHRvIGtlZXAgdGhlIGxhdGVzdCBlcnJvclxuICAgIHRoaXMub24oJ2Vycm9yJywgKGVycm9yKSA9PiAodGhpcy4jZXJyb3IgPSBlcnJvcikpO1xuICB9XG5cbiAgYXN5bmMgb3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5qb2JJbmZvID0gYXdhaXQgdGhpcy5jcmVhdGVRdWVyeVJlcXVlc3Q8Sm9iSW5mb1YyPih7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIG9wZXJhdGlvbjogdGhpcy4jb3BlcmF0aW9uLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLiNxdWVyeSxcbiAgICAgICAgfSksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnLFxuICAgICAgICB9LFxuICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5lbWl0KCdvcGVuJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0IHRoZSBzdGF0dXMgdG8gYWJvcnRcbiAgICovXG4gIGFzeW5jIGFib3J0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdGF0ZTogSm9iU3RhdGVWMiA9ICdBYm9ydGVkJztcbiAgICAgIHRoaXMuam9iSW5mbyA9IGF3YWl0IHRoaXMuY3JlYXRlUXVlcnlSZXF1ZXN0PEpvYkluZm9WMj4oe1xuICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgIHBhdGg6IGAvJHt0aGlzLmpvYkluZm8/LmlkfWAsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgc3RhdGUgfSksXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04JyB9LFxuICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5lbWl0KCdhYm9ydGVkJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICBhc3luYyBwb2xsKFxuICAgIGludGVydmFsOiBudW1iZXIgPSB0aGlzLiNwb2xsaW5nT3B0aW9ucy5wb2xsSW50ZXJ2YWwsXG4gICAgdGltZW91dDogbnVtYmVyID0gdGhpcy4jcG9sbGluZ09wdGlvbnMucG9sbFRpbWVvdXQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGpvYklkID0gZ2V0Sm9iSWRPckVycm9yKHRoaXMuam9iSW5mbyk7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIHdoaWxlIChzdGFydFRpbWUgKyB0aW1lb3V0ID4gRGF0ZS5ub3coKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5jaGVjaygpO1xuICAgICAgICBzd2l0Y2ggKHJlcy5zdGF0ZSkge1xuICAgICAgICAgIGNhc2UgJ09wZW4nOlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdKb2IgaGFzIG5vdCBiZWVuIHN0YXJ0ZWQnKTtcbiAgICAgICAgICBjYXNlICdBYm9ydGVkJzpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSm9iIGhhcyBiZWVuIGFib3J0ZWQnKTtcbiAgICAgICAgICBjYXNlICdVcGxvYWRDb21wbGV0ZSc6XG4gICAgICAgICAgY2FzZSAnSW5Qcm9ncmVzcyc6XG4gICAgICAgICAgICBhd2FpdCBkZWxheShpbnRlcnZhbCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdGYWlsZWQnOlxuICAgICAgICAgICAgdGhpcy5lbWl0KCdmYWlsZWQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBjYXNlICdKb2JDb21wbGV0ZSc6XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2pvYmNvbXBsZXRlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRpbWVvdXRFcnJvciA9IG5ldyBKb2JQb2xsaW5nVGltZW91dEVycm9yKFxuICAgICAgYFBvbGxpbmcgdGltZSBvdXQuIEpvYiBJZCA9ICR7am9iSWR9YCxcbiAgICAgIGpvYklkLFxuICAgICk7XG4gICAgdGhpcy5lbWl0KCdlcnJvcicsIHRpbWVvdXRFcnJvcik7XG4gICAgdGhyb3cgdGltZW91dEVycm9yO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBsYXRlc3QgYmF0Y2ggc3RhdHVzIGluIHNlcnZlclxuICAgKi9cbiAgYXN5bmMgY2hlY2soKTogUHJvbWlzZTxKb2JJbmZvVjI+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgam9iSW5mbyA9IGF3YWl0IHRoaXMuY3JlYXRlUXVlcnlSZXF1ZXN0PEpvYkluZm9WMj4oe1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBwYXRoOiBgLyR7Z2V0Sm9iSWRPckVycm9yKHRoaXMuam9iSW5mbyl9YCxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9KTtcbiAgICAgIHRoaXMuam9iSW5mbyA9IGpvYkluZm87XG4gICAgICByZXR1cm4gam9iSW5mbztcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFJlc3VsdHMoKTogUHJvbWlzZTxSZWNvcmRbXT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy4jcXVlcnlSZXN1bHRzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiNxdWVyeVJlc3VsdHM7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmNyZWF0ZVF1ZXJ5UmVxdWVzdDxSZWNvcmRbXSB8IHVuZGVmaW5lZD4oe1xuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBwYXRoOiBgLyR7Z2V0Sm9iSWRPckVycm9yKHRoaXMuam9iSW5mbyl9L3Jlc3VsdHNgLFxuICAgICAgICByZXNwb25zZVR5cGU6ICd0ZXh0L2NzdicsXG4gICAgICB9KTtcblxuICAgICAgdGhpcy4jcXVlcnlSZXN1bHRzID0gcmVzdWx0cyA/PyBbXTtcblxuICAgICAgcmV0dXJuIHRoaXMuI3F1ZXJ5UmVzdWx0cztcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVRdWVyeVJlcXVlc3Q8dm9pZD4oe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHBhdGg6IGAvJHtnZXRKb2JJZE9yRXJyb3IodGhpcy5qb2JJbmZvKX1gLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVRdWVyeVJlcXVlc3Q8VD4ocmVxdWVzdDogQnVsa1JlcXVlc3QpIHtcbiAgICBjb25zdCB7IHBhdGgsIHJlc3BvbnNlVHlwZSB9ID0gcmVxdWVzdDtcbiAgICBjb25zdCBiYXNlVXJsID0gW1xuICAgICAgdGhpcy4jY29ubmVjdGlvbi5pbnN0YW5jZVVybCxcbiAgICAgICdzZXJ2aWNlcy9kYXRhJyxcbiAgICAgIGB2JHt0aGlzLiNjb25uZWN0aW9uLnZlcnNpb259YCxcbiAgICAgICdqb2JzL3F1ZXJ5JyxcbiAgICBdLmpvaW4oJy8nKTtcblxuICAgIHJldHVybiBuZXcgQnVsa0FwaVYyKHRoaXMuI2Nvbm5lY3Rpb24sIHsgcmVzcG9uc2VUeXBlIH0pLnJlcXVlc3Q8VD4oe1xuICAgICAgLi4ucmVxdWVzdCxcbiAgICAgIHVybDogYmFzZVVybCArIHBhdGgsXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDbGFzcyBmb3IgQnVsayBBUEkgVjIgSW5nZXN0IEpvYlxuICovXG5leHBvcnQgY2xhc3MgSW5nZXN0Sm9iVjI8XG4gIFMgZXh0ZW5kcyBTY2hlbWEsXG4gIE9wciBleHRlbmRzIEluZ2VzdE9wZXJhdGlvblxuPiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIHJlYWRvbmx5ICNjb25uZWN0aW9uOiBDb25uZWN0aW9uPFM+O1xuICByZWFkb25seSAjcG9sbGluZ09wdGlvbnM6IEJ1bGtWMlBvbGxpbmdPcHRpb25zO1xuICByZWFkb25seSAjam9iRGF0YTogSm9iRGF0YVYyPFMsIE9wcj47XG4gICNidWxrSm9iU3VjY2Vzc2Z1bFJlc3VsdHM6IEluZ2VzdEpvYlYyU3VjY2Vzc2Z1bFJlc3VsdHM8Uz4gfCB1bmRlZmluZWQ7XG4gICNidWxrSm9iRmFpbGVkUmVzdWx0czogSW5nZXN0Sm9iVjJGYWlsZWRSZXN1bHRzPFM+IHwgdW5kZWZpbmVkO1xuICAjYnVsa0pvYlVucHJvY2Vzc2VkUmVjb3JkczogSW5nZXN0Sm9iVjJVbnByb2Nlc3NlZFJlY29yZHM8Uz4gfCB1bmRlZmluZWQ7XG4gICNlcnJvcjogRXJyb3IgfCB1bmRlZmluZWQ7XG4gIGpvYkluZm86IFBhcnRpYWw8Sm9iSW5mb1YyPjtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENyZWF0ZUluZ2VzdEpvYlYyT3B0aW9uczxTPikge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLiNjb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIHRoaXMuI3BvbGxpbmdPcHRpb25zID0gb3B0aW9ucy5wb2xsaW5nT3B0aW9ucztcbiAgICB0aGlzLmpvYkluZm8gPSBvcHRpb25zLmpvYkluZm87XG4gICAgdGhpcy4jam9iRGF0YSA9IG5ldyBKb2JEYXRhVjI8UywgT3ByPih7XG4gICAgICBjcmVhdGVSZXF1ZXN0OiAocmVxdWVzdCkgPT4gdGhpcy5jcmVhdGVJbmdlc3RSZXF1ZXN0KHJlcXVlc3QpLFxuICAgICAgam9iOiB0aGlzLFxuICAgIH0pO1xuICAgIC8vIGRlZmF1bHQgZXJyb3IgaGFuZGxlciB0byBrZWVwIHRoZSBsYXRlc3QgZXJyb3JcbiAgICB0aGlzLm9uKCdlcnJvcicsIChlcnJvcikgPT4gKHRoaXMuI2Vycm9yID0gZXJyb3IpKTtcbiAgfVxuXG4gIGdldCBpZCgpIHtcbiAgICByZXR1cm4gdGhpcy5qb2JJbmZvLmlkO1xuICB9XG5cbiAgYXN5bmMgb3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5qb2JJbmZvID0gYXdhaXQgdGhpcy5jcmVhdGVJbmdlc3RSZXF1ZXN0PEpvYkluZm9WMj4oe1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgcGF0aDogJycsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBhc3NpZ25tZW50UnVsZUlkOiB0aGlzLmpvYkluZm8/LmFzc2lnbm1lbnRSdWxlSWQsXG4gICAgICAgICAgZXh0ZXJuYWxJZEZpZWxkTmFtZTogdGhpcy5qb2JJbmZvPy5leHRlcm5hbElkRmllbGROYW1lLFxuICAgICAgICAgIG9iamVjdDogdGhpcy5qb2JJbmZvPy5vYmplY3QsXG4gICAgICAgICAgb3BlcmF0aW9uOiB0aGlzLmpvYkluZm8/Lm9wZXJhdGlvbixcbiAgICAgICAgfSksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnLFxuICAgICAgICB9LFxuICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5lbWl0KCdvcGVuJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICBhc3luYyB1cGxvYWREYXRhKGlucHV0OiBzdHJpbmcgfCBSZWNvcmRbXSB8IFJlYWRhYmxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy4jam9iRGF0YS5leGVjdXRlKGlucHV0KTtcbiAgfVxuXG4gIGFzeW5jIGdldEFsbFJlc3VsdHMoKTogUHJvbWlzZTxJbmdlc3RKb2JWMlJlc3VsdHM8Uz4+IHtcbiAgICBjb25zdCBbXG4gICAgICBzdWNjZXNzZnVsUmVzdWx0cyxcbiAgICAgIGZhaWxlZFJlc3VsdHMsXG4gICAgICB1bnByb2Nlc3NlZFJlY29yZHMsXG4gICAgXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuZ2V0U3VjY2Vzc2Z1bFJlc3VsdHMoKSxcbiAgICAgIHRoaXMuZ2V0RmFpbGVkUmVzdWx0cygpLFxuICAgICAgdGhpcy5nZXRVbnByb2Nlc3NlZFJlY29yZHMoKSxcbiAgICBdKTtcbiAgICByZXR1cm4geyBzdWNjZXNzZnVsUmVzdWx0cywgZmFpbGVkUmVzdWx0cywgdW5wcm9jZXNzZWRSZWNvcmRzIH07XG4gIH1cblxuICAvKipcbiAgICogQ2xvc2Ugb3BlbmVkIGpvYlxuICAgKi9cbiAgYXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXRlOiBKb2JTdGF0ZVYyID0gJ1VwbG9hZENvbXBsZXRlJztcbiAgICAgIHRoaXMuam9iSW5mbyA9IGF3YWl0IHRoaXMuY3JlYXRlSW5nZXN0UmVxdWVzdDxKb2JJbmZvVjI+KHtcbiAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICBwYXRoOiBgLyR7dGhpcy5qb2JJbmZvLmlkfWAsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgc3RhdGUgfSksXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04JyB9LFxuICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5lbWl0KCd1cGxvYWRjb21wbGV0ZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNldCB0aGUgc3RhdHVzIHRvIGFib3J0XG4gICAqL1xuICBhc3luYyBhYm9ydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdGU6IEpvYlN0YXRlVjIgPSAnQWJvcnRlZCc7XG4gICAgICB0aGlzLmpvYkluZm8gPSBhd2FpdCB0aGlzLmNyZWF0ZUluZ2VzdFJlcXVlc3Q8Sm9iSW5mb1YyPih7XG4gICAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgICAgcGF0aDogYC8ke3RoaXMuam9iSW5mby5pZH1gLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHN0YXRlIH0pLFxuICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOCcgfSxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9KTtcbiAgICAgIHRoaXMuZW1pdCgnYWJvcnRlZCcpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcG9sbChcbiAgICBpbnRlcnZhbDogbnVtYmVyID0gdGhpcy4jcG9sbGluZ09wdGlvbnMucG9sbEludGVydmFsLFxuICAgIHRpbWVvdXQ6IG51bWJlciA9IHRoaXMuI3BvbGxpbmdPcHRpb25zLnBvbGxUaW1lb3V0LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBqb2JJZCA9IGdldEpvYklkT3JFcnJvcih0aGlzLmpvYkluZm8pO1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cbiAgICB3aGlsZSAoc3RhcnRUaW1lICsgdGltZW91dCA+IERhdGUubm93KCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuY2hlY2soKTtcbiAgICAgICAgc3dpdGNoIChyZXMuc3RhdGUpIHtcbiAgICAgICAgICBjYXNlICdPcGVuJzpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSm9iIGhhcyBub3QgYmVlbiBzdGFydGVkJyk7XG4gICAgICAgICAgY2FzZSAnQWJvcnRlZCc6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0pvYiBoYXMgYmVlbiBhYm9ydGVkJyk7XG4gICAgICAgICAgY2FzZSAnVXBsb2FkQ29tcGxldGUnOlxuICAgICAgICAgIGNhc2UgJ0luUHJvZ3Jlc3MnOlxuICAgICAgICAgICAgYXdhaXQgZGVsYXkoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnRmFpbGVkJzpcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZmFpbGVkJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgY2FzZSAnSm9iQ29tcGxldGUnOlxuICAgICAgICAgICAgdGhpcy5lbWl0KCdqb2Jjb21wbGV0ZScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0aW1lb3V0RXJyb3IgPSBuZXcgSm9iUG9sbGluZ1RpbWVvdXRFcnJvcihcbiAgICAgIGBQb2xsaW5nIHRpbWUgb3V0LiBKb2IgSWQgPSAke2pvYklkfWAsXG4gICAgICBqb2JJZCxcbiAgICApO1xuICAgIHRoaXMuZW1pdCgnZXJyb3InLCB0aW1lb3V0RXJyb3IpO1xuICAgIHRocm93IHRpbWVvdXRFcnJvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB0aGUgbGF0ZXN0IGJhdGNoIHN0YXR1cyBpbiBzZXJ2ZXJcbiAgICovXG4gIGFzeW5jIGNoZWNrKCk6IFByb21pc2U8Sm9iSW5mb1YyPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGpvYkluZm8gPSBhd2FpdCB0aGlzLmNyZWF0ZUluZ2VzdFJlcXVlc3Q8Sm9iSW5mb1YyPih7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHBhdGg6IGAvJHtnZXRKb2JJZE9yRXJyb3IodGhpcy5qb2JJbmZvKX1gLFxuICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5qb2JJbmZvID0gam9iSW5mbztcbiAgICAgIHJldHVybiBqb2JJbmZvO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0U3VjY2Vzc2Z1bFJlc3VsdHMoKTogUHJvbWlzZTxJbmdlc3RKb2JWMlN1Y2Nlc3NmdWxSZXN1bHRzPFM+PiB7XG4gICAgaWYgKHRoaXMuI2J1bGtKb2JTdWNjZXNzZnVsUmVzdWx0cykge1xuICAgICAgcmV0dXJuIHRoaXMuI2J1bGtKb2JTdWNjZXNzZnVsUmVzdWx0cztcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5jcmVhdGVJbmdlc3RSZXF1ZXN0PFxuICAgICAgSW5nZXN0Sm9iVjJTdWNjZXNzZnVsUmVzdWx0czxTPiB8IHVuZGVmaW5lZFxuICAgID4oe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHBhdGg6IGAvJHtnZXRKb2JJZE9yRXJyb3IodGhpcy5qb2JJbmZvKX0vc3VjY2Vzc2Z1bFJlc3VsdHNgLFxuICAgICAgcmVzcG9uc2VUeXBlOiAndGV4dC9jc3YnLFxuICAgIH0pO1xuXG4gICAgdGhpcy4jYnVsa0pvYlN1Y2Nlc3NmdWxSZXN1bHRzID0gcmVzdWx0cyA/PyBbXTtcblxuICAgIHJldHVybiB0aGlzLiNidWxrSm9iU3VjY2Vzc2Z1bFJlc3VsdHM7XG4gIH1cblxuICBhc3luYyBnZXRGYWlsZWRSZXN1bHRzKCk6IFByb21pc2U8SW5nZXN0Sm9iVjJGYWlsZWRSZXN1bHRzPFM+PiB7XG4gICAgaWYgKHRoaXMuI2J1bGtKb2JGYWlsZWRSZXN1bHRzKSB7XG4gICAgICByZXR1cm4gdGhpcy4jYnVsa0pvYkZhaWxlZFJlc3VsdHM7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY3JlYXRlSW5nZXN0UmVxdWVzdDxcbiAgICAgIEluZ2VzdEpvYlYyRmFpbGVkUmVzdWx0czxTPiB8IHVuZGVmaW5lZFxuICAgID4oe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHBhdGg6IGAvJHtnZXRKb2JJZE9yRXJyb3IodGhpcy5qb2JJbmZvKX0vZmFpbGVkUmVzdWx0c2AsXG4gICAgICByZXNwb25zZVR5cGU6ICd0ZXh0L2NzdicsXG4gICAgfSk7XG5cbiAgICB0aGlzLiNidWxrSm9iRmFpbGVkUmVzdWx0cyA9IHJlc3VsdHMgPz8gW107XG5cbiAgICByZXR1cm4gdGhpcy4jYnVsa0pvYkZhaWxlZFJlc3VsdHM7XG4gIH1cblxuICBhc3luYyBnZXRVbnByb2Nlc3NlZFJlY29yZHMoKTogUHJvbWlzZTxJbmdlc3RKb2JWMlVucHJvY2Vzc2VkUmVjb3JkczxTPj4ge1xuICAgIGlmICh0aGlzLiNidWxrSm9iVW5wcm9jZXNzZWRSZWNvcmRzKSB7XG4gICAgICByZXR1cm4gdGhpcy4jYnVsa0pvYlVucHJvY2Vzc2VkUmVjb3JkcztcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgdGhpcy5jcmVhdGVJbmdlc3RSZXF1ZXN0PFxuICAgICAgSW5nZXN0Sm9iVjJVbnByb2Nlc3NlZFJlY29yZHM8Uz4gfCB1bmRlZmluZWRcbiAgICA+KHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBwYXRoOiBgLyR7Z2V0Sm9iSWRPckVycm9yKHRoaXMuam9iSW5mbyl9L3VucHJvY2Vzc2VkcmVjb3Jkc2AsXG4gICAgICByZXNwb25zZVR5cGU6ICd0ZXh0L2NzdicsXG4gICAgfSk7XG5cbiAgICB0aGlzLiNidWxrSm9iVW5wcm9jZXNzZWRSZWNvcmRzID0gcmVzdWx0cyA/PyBbXTtcblxuICAgIHJldHVybiB0aGlzLiNidWxrSm9iVW5wcm9jZXNzZWRSZWNvcmRzO1xuICB9XG5cbiAgYXN5bmMgZGVsZXRlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUluZ2VzdFJlcXVlc3Q8dm9pZD4oe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHBhdGg6IGAvJHtnZXRKb2JJZE9yRXJyb3IodGhpcy5qb2JJbmZvKX1gLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVJbmdlc3RSZXF1ZXN0PFQ+KHJlcXVlc3Q6IEJ1bGtSZXF1ZXN0KSB7XG4gICAgY29uc3QgeyBwYXRoLCByZXNwb25zZVR5cGUgfSA9IHJlcXVlc3Q7XG4gICAgY29uc3QgYmFzZVVybCA9IFtcbiAgICAgIHRoaXMuI2Nvbm5lY3Rpb24uaW5zdGFuY2VVcmwsXG4gICAgICAnc2VydmljZXMvZGF0YScsXG4gICAgICBgdiR7dGhpcy4jY29ubmVjdGlvbi52ZXJzaW9ufWAsXG4gICAgICAnam9icy9pbmdlc3QnLFxuICAgIF0uam9pbignLycpO1xuXG4gICAgcmV0dXJuIG5ldyBCdWxrQXBpVjIodGhpcy4jY29ubmVjdGlvbiwgeyByZXNwb25zZVR5cGUgfSkucmVxdWVzdDxUPih7XG4gICAgICAuLi5yZXF1ZXN0LFxuICAgICAgdXJsOiBiYXNlVXJsICsgcGF0aCxcbiAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBKb2JEYXRhVjI8XG4gIFMgZXh0ZW5kcyBTY2hlbWEsXG4gIE9wciBleHRlbmRzIEluZ2VzdE9wZXJhdGlvblxuPiBleHRlbmRzIFdyaXRhYmxlIHtcbiAgcmVhZG9ubHkgI2pvYjogSW5nZXN0Sm9iVjI8UywgT3ByPjtcbiAgcmVhZG9ubHkgI3VwbG9hZFN0cmVhbTogU2VyaWFsaXphYmxlO1xuICByZWFkb25seSAjZG93bmxvYWRTdHJlYW06IFBhcnNhYmxlO1xuICByZWFkb25seSAjZGF0YVN0cmVhbTogRHVwbGV4O1xuICAjcmVzdWx0OiBhbnk7XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDcmVhdGVKb2JEYXRhVjJPcHRpb25zPFMsIE9wcj4pIHtcbiAgICBzdXBlcih7IG9iamVjdE1vZGU6IHRydWUgfSk7XG5cbiAgICBjb25zdCBjcmVhdGVSZXF1ZXN0ID0gb3B0aW9ucy5jcmVhdGVSZXF1ZXN0O1xuXG4gICAgdGhpcy4jam9iID0gb3B0aW9ucy5qb2I7XG4gICAgdGhpcy4jdXBsb2FkU3RyZWFtID0gbmV3IFNlcmlhbGl6YWJsZSgpO1xuICAgIHRoaXMuI2Rvd25sb2FkU3RyZWFtID0gbmV3IFBhcnNhYmxlKCk7XG5cbiAgICBjb25zdCBjb252ZXJ0ZXJPcHRpb25zID0geyBudWxsVmFsdWU6ICcjTi9BJyB9O1xuICAgIGNvbnN0IHVwbG9hZERhdGFTdHJlYW0gPSB0aGlzLiN1cGxvYWRTdHJlYW0uc3RyZWFtKCdjc3YnLCBjb252ZXJ0ZXJPcHRpb25zKTtcbiAgICBjb25zdCBkb3dubG9hZERhdGFTdHJlYW0gPSB0aGlzLiNkb3dubG9hZFN0cmVhbS5zdHJlYW0oXG4gICAgICAnY3N2JyxcbiAgICAgIGNvbnZlcnRlck9wdGlvbnMsXG4gICAgKTtcblxuICAgIHRoaXMuI2RhdGFTdHJlYW0gPSBjb25jYXRTdHJlYW1zQXNEdXBsZXgoXG4gICAgICB1cGxvYWREYXRhU3RyZWFtLFxuICAgICAgZG93bmxvYWREYXRhU3RyZWFtLFxuICAgICk7XG5cbiAgICB0aGlzLm9uKCdmaW5pc2gnLCAoKSA9PiB0aGlzLiN1cGxvYWRTdHJlYW0uZW5kKCkpO1xuXG4gICAgdXBsb2FkRGF0YVN0cmVhbS5vbmNlKCdyZWFkYWJsZScsICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIHBpcGUgdXBsb2FkIGRhdGEgdG8gYmF0Y2ggQVBJIHJlcXVlc3Qgc3RyZWFtXG4gICAgICAgIGNvbnN0IHJlcSA9IGNyZWF0ZVJlcXVlc3Qoe1xuICAgICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgICAgcGF0aDogYC8ke3RoaXMuI2pvYi5qb2JJbmZvPy5pZH0vYmF0Y2hlc2AsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2NzdicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZXNwb25zZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgcmVxO1xuICAgICAgICAgICAgdGhpcy5lbWl0KCdyZXNwb25zZScsIHJlcyk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG5cbiAgICAgICAgdXBsb2FkRGF0YVN0cmVhbS5waXBlKHJlcS5zdHJlYW0oKSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBfd3JpdGUocmVjb3JkXzogUmVjb3JkLCBlbmM6IHN0cmluZywgY2I6ICgpID0+IHZvaWQpIHtcbiAgICBjb25zdCB7IElkLCB0eXBlLCBhdHRyaWJ1dGVzLCAuLi5ycmVjIH0gPSByZWNvcmRfO1xuICAgIGxldCByZWNvcmQ7XG4gICAgc3dpdGNoICh0aGlzLiNqb2Iuam9iSW5mby5vcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJ2luc2VydCc6XG4gICAgICAgIHJlY29yZCA9IHJyZWM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgIGNhc2UgJ2hhcmREZWxldGUnOlxuICAgICAgICByZWNvcmQgPSB7IElkIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmVjb3JkID0geyBJZCwgLi4ucnJlYyB9O1xuICAgIH1cbiAgICB0aGlzLiN1cGxvYWRTdHJlYW0ud3JpdGUocmVjb3JkLCBlbmMsIGNiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGR1cGxleCBzdHJlYW0gd2hpY2ggYWNjZXB0cyBDU1YgZGF0YSBpbnB1dCBhbmQgYmF0Y2ggcmVzdWx0IG91dHB1dFxuICAgKi9cbiAgc3RyZWFtKCkge1xuICAgIHJldHVybiB0aGlzLiNkYXRhU3RyZWFtO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYmF0Y2ggb3BlcmF0aW9uXG4gICAqL1xuICBleGVjdXRlKGlucHV0Pzogc3RyaW5nIHwgUmVjb3JkW10gfCBSZWFkYWJsZSkge1xuICAgIGlmICh0aGlzLiNyZXN1bHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRGF0YSBjYW4gb25seSBiZSB1cGxvYWRlZCB0byBhIGpvYiBvbmNlLicpO1xuICAgIH1cblxuICAgIHRoaXMuI3Jlc3VsdCA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMub25jZSgncmVzcG9uc2UnLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIHJlamVjdCk7XG4gICAgfSk7XG5cbiAgICBpZiAoaXNPYmplY3QoaW5wdXQpICYmICdwaXBlJyBpbiBpbnB1dCAmJiBpc0Z1bmN0aW9uKGlucHV0LnBpcGUpKSB7XG4gICAgICAvLyBpZiBpbnB1dCBoYXMgc3RyZWFtLlJlYWRhYmxlIGludGVyZmFjZVxuICAgICAgaW5wdXQucGlwZSh0aGlzLiNkYXRhU3RyZWFtKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW5wdXQpKSB7XG4gICAgICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIGlucHV0KSB7XG4gICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMocmVjb3JkKSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZWNvcmRba2V5XSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgIHJlY29yZFtrZXldID0gU3RyaW5nKHJlY29yZFtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy53cml0ZShyZWNvcmQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW5kKCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy4jZGF0YVN0cmVhbS53cml0ZShpbnB1dCwgJ3V0ZjgnKTtcbiAgICAgICAgdGhpcy4jZGF0YVN0cmVhbS5lbmQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9taXNlL0ErIGludGVyZmFjZVxuICAgKiBEZWxlZ2F0ZSB0byBwcm9taXNlLCByZXR1cm4gcHJvbWlzZSBpbnN0YW5jZSBmb3IgYmF0Y2ggcmVzdWx0XG4gICAqL1xuICB0aGVuKG9uUmVzb2x2ZWQ6ICgpID0+IHZvaWQsIG9uUmVqZWN0OiAoZXJyOiBhbnkpID0+IHZvaWQpIHtcbiAgICBpZiAodGhpcy4jcmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZXhlY3V0ZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jcmVzdWx0IS50aGVuKG9uUmVzb2x2ZWQsIG9uUmVqZWN0KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRKb2JJZE9yRXJyb3Ioam9iSW5mbzogUGFydGlhbDxKb2JJbmZvVjI+IHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgY29uc3Qgam9iSWQgPSBqb2JJbmZvPy5pZDtcbiAgaWYgKGpvYklkID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGpvYiBpZCwgbWF5YmUgeW91IG5lZWQgdG8gY2FsbCBgam9iLm9wZW4oKWAgZmlyc3QuJyk7XG4gIH1cbiAgcmV0dXJuIGpvYklkO1xufVxuXG5mdW5jdGlvbiBkZWxheShtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qXG4gKiBSZWdpc3RlciBob29rIGluIGNvbm5lY3Rpb24gaW5zdGFudGlhdGlvbiBmb3IgZHluYW1pY2FsbHkgYWRkaW5nIHRoaXMgQVBJIG1vZHVsZSBmZWF0dXJlc1xuICovXG5yZWdpc3Rlck1vZHVsZSgnYnVsaycsIChjb25uKSA9PiBuZXcgQnVsayhjb25uKSk7XG5yZWdpc3Rlck1vZHVsZSgnYnVsazInLCAoY29ubikgPT4gbmV3IEJ1bGtWMihjb25uKSk7XG5cbmV4cG9ydCBkZWZhdWx0IEJ1bGs7XG4iXX0=