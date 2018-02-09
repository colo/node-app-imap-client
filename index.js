'use strict'

var App = require('node-app'),
		path = require('path'),
		fs = require('fs'),
		//Imap = require('node-imap-client'),
		pathToRegexp = require('path-to-regexp'),
		Imap = require('imap');

const url = require('url');		
const { URLSearchParams } = require('url');

//var Logger = require('node-express-logger'),
var Authorization = require('node-express-authorization');
	//Authentication = require('node-express-authentication');

var debug = require('debug')('app-imap-client');
var debug_events = require('debug')('app-imap-client:Events');
var debug_internals = require('debug')('app-imap-client:Internals');


var AppImapClient = new Class({
  //Implements: [Options, Events],
  Extends: App,
  
  ON_CONNECT: 'onConnect',
  ON_CONNECT_ERROR: 'onConnectError',
  
  request: null,
  
  api: {},
  
  methods: [
	/**
	 * search (< array >criteria, < function >callback) - (void) - Searches the currently open mailbox for messages using
	 * given criteria. criteria is a list describing what you want to find. For criteria types that require arguments,
	 * use an array instead of just the string criteria type name (e.g. ['FROM', 'foo@bar.com']).
	 * Prefix criteria types with an "!" to negate.
	 * */
	 'search',
	 'seq.search',
		 
	 /**
		* fetch(< MessageSource >source, [< object >options]) - ImapFetch - Fetches message(s) in the currently open mailbox.
		* */
		'fetch',
		'seq.fetch',


	],
  
  authorization:null,
  //authentication: null,
  _merged_apps: {},
  
  options: {
		
		
		host: '127.0.0.1',
		port: 143,
		/**
		 * https://github.com/mscdex/node-imap#connection-instance-methods
		 * */
		opts: {},
		
		path: '',
		mailbox: 'INBOX',
		
		//db: '',
		
		//cradle: {
			//cache: true,
			//raw: false,
			//forceSave: true,
		//},
		
		
		logs: null,
		
		authentication: null,
		
		//authentication: {
			//username: 'user',
			//password: 'pass',
			//sendImmediately: true,
			//bearer: 'bearer,
			//basic: false
		//},
		
		authorization: null,
		
		routes: {
		},
		/*routes: {
			
			get: [
				{
					path: '/:param',
					callbacks: ['check_authentication', 'get'],
					content_type: /text\/plain/,
				},
			],
			post: [
				{
				path: '',
				callbacks: ['', 'post']
				},
			],
			all: [
				{
				path: '',
				callbacks: ['', 'get']
				},
			]
			
		},*/
		
		//api: {
			
			//content_type: 'application/json',
			
			//path: '',
			
			//version: '0.0.0',
			
			//versioned_path: false, //default false
			
			////accept_header: 'accept-version', //implement?
			
			///*routes: {
				//get: [
					//{
					//path: '',
					//callbacks: ['get_api'],
					//content_type: 'application/x-www-form-urlencoded',
					////version: '1.0.1',
					//},
					//{
					//path: ':service_action',
					//callbacks: ['get_api'],
					//version: '2.0.0',
					//},
					//{
					//path: ':service_action',
					//callbacks: ['get_api'],
					//version: '1.0.1',
					//},
				//],
				//post: [
					//{
					//path: '',
					//callbacks: ['check_authentication', 'post'],
					//},
				//],
				//all: [
					//{
					//path: '',
					//callbacks: ['get'],
					//version: '',
					//},
				//]
				
			//},*/
			
			
			///*doc: {
				//'/': {
					//type: 'function',
					//returns: 'array',
					//description: 'Return an array of registered servers',
					//example: '{"username":"lbueno","password":"40bd001563085fc35165329ea1ff5c5ecbdbbeef"} / curl -v -L -H "Accept: application/json" -H "Content-type: application/json" -X POST -d \' {"user":"something","password":"app123"}\'  http://localhost:8080/login'

				//}
			//},*/
		//},
  },
  initialize: function(options){
		//throw new Error('Maybe implement with https://www.npmjs.com/package/node-imap-client');
		
		this.parent(options);//override default options
		
		/**
		 * imap
		 *  - start
		 * **/
		var conn_opts = Object.merge({ host: this.options.host, port: this.options.port }, this.options.opts);
		
		this.request = new Imap(conn_opts);
		
		this.request.once('error', function(err) {
			debug_internals('connection error %o', err);
			
			this.fireEvent(this.ON_CONNECT_ERROR, {host: this.options.host, user: this.options.opts.user, error: err });
			
		}.bind(this));

		this.request.once('end', function() {
			debug_internals('connection ended');
			
			this.fireEvent(this.ON_CONNECT_ERROR, {host: this.options.host, user: this.options.opts.user, error: new Error('Connection ended.') });
			
		}.bind(this));
		
		this.request.once('ready', function() {
			debug_internals('connection ready->state %s', this.request.state);
			
			this.fireEvent(this.ON_CONNECT, {host: this.options.host, user: this.options.opts.user} );
			/**
			 * tests
			 * */
			//this.request.destroy();
			//this.request.end();
		}.bind(this));
		
		this.request.connect();
		
		debug_internals('this.request %o', this.request);
		
		/**
		 * imap
		 *  - end
		 * **/
		 
		
		
		//if(this.options.db);
			//this.request.database(this.options.db);
		
		if(this.logger)
			this.logger.extend_app(this);
		
		/**
		 * logger
		 *  - end
		 * **/
		
		/**
		 * authorization
		 * - start
		 * */
		 if(this.options.authorization && this.options.authorization.init !== false){
			 var authorization = null;
			 
			 if(typeof(this.options.authorization) == 'class'){
				 authorization = new this.options.authorization({});
				 this.options.authorization = {};
			 }
			 else if(typeof(this.options.authorization) == 'function'){
				authorization = this.options.authorization;
				this.options.authorization = {};
			}
			else if(this.options.authorization.config){
				var rbac = this.options.authorization.config;
				
				if(typeof(this.options.authorization.config) == 'string'){
					//rbac = fs.readFileSync(path.join(__dirname, this.options.authorization.config ), 'ascii');
					rbac = fs.readFileSync(this.options.authorization.config , 'ascii');
					this.options.authorization.config = rbac;
				}
				
				authorization = new Authorization(this, 
					JSON.decode(
						rbac
					)
				);
			}
			
			if(authorization){
				this.authorization = authorization;
				//app.use(this.authorization.session());
			}
		}
		/**
		 * authorization
		 * - end
		 * */
		
		//if(this.options.routes && this.options.api.routes)
			//this.apply_routes(this.options.routes, true);
		
		this.apply_routes(this.options.routes, false);
		
		
  },
  apply_routes: function(routes, is_api){
		var uri = '';
		
		var instance = this;
		//var conn = this.request;
		
			
		Array.each(this.methods, function(verb){
			
			debug('VERB %s', verb);
			//console.log(verb);
			/**
			 * @callback_alt if typeof function, gets executed instead of the method asigned to the matched route (is an alternative callback, instead of the default usage)
			 * */
			instance[verb] = function(verb, original_func, options, callback_alt){
				debug_internals('instance[verb] %o', arguments);
				
				var request;//the request object to return
				
				var path = '';
				
				path = (typeof(this.options.path) !== "undefined") ? this.options.path : '';
				
				debug_internals('instance[verb] path %o', path);
				
				options = options || {};
				
				
				debug_internals('instance[verb] routes %o', routes);
				
				if(routes[verb]){
					var uri_matched = false;
					
					Array.each(routes[verb], function(route){
						debug_internals('instance[verb] route.path %s', route.path);
						
						route.path = route.path || '';
						options.uri = options.uri || '';
						
						var keys = []
						var re = pathToRegexp(route.path, keys);
						
						//console.log('route path: '+route.path);
						//console.log(re.exec(options.uri));
						//console.log('options.uri: '+options.uri);
						//console.log(path);
						//console.log(keys);
						//console.log('--------');
							
						if(options.uri != null && re.test(options.uri) == true){
							uri_matched = true;
							
							debug_internals('routes[verb] uri matched %o', options);
							debug_internals('routes[verb] uri matched->re.exec %o', re.exec(options.uri));
							
							
							var callbacks = [];
							
							/**
							 * if no callbacks defined for a route, you should use callback_alt param
							 * */
							if(route.callbacks && route.callbacks.length > 0){
								route.callbacks.each(function(fn){
									//console.log('route function: ' + fn);
									
									//if the callback function, has the same name as the verb, we had it already copied as "original_func"
									if(fn == verb){
										callbacks.push({ func: original_func.bind(this), name: fn });
									}
									else{
										callbacks.push({ func: this[fn].bind(this), name: fn });
									}
									
								}.bind(this));
							}
							
							var merged = {};
							
							var response = function(err, resp){
								
								debug_internals('response verb %s', verb);
								
								if(err){
									debug_internals('response err %o', err);
									//////this.fireEvent(this.ON_CONNECT_ERROR, {options: merged, uri: options.uri, route: route.path, error: err });
									this.fireEvent(this.ON_CONNECT_ERROR, {uri: options.uri, route: route.path, error: err });
								}
								else{
									debug_internals('response %o', resp);
									
									//this.request.disconnect();
									
									this.fireEvent(this.ON_CONNECT, {uri: options.uri, route: route.path, response: resp} );
									//this.fireEvent(this.ON_CONNECT, resp);
								}

								
								if(typeof(callback_alt) == 'function' || callback_alt instanceof Function){
									var profile = 'ID['+this.options.id+']:METHOD['+verb+']:PATH['+merged.uri+']:CALLBACK[*callback_alt*]';
									
									if(process.env.PROFILING_ENV && this.logger) this.profile(profile);
									
									callback_alt(err, resp, {uri: options.uri, route: route.path });
									
									if(process.env.PROFILING_ENV && this.logger) this.profile(profile);
								}
								else{
									//console.log(callbacks);
									Array.each(callbacks, function(fn){
										var callback = fn.func;
										var name = fn.name;
										
										var profile = 'ID['+this.options.id+']:METHOD['+verb+']:PATH['+merged.uri+']:CALLBACK['+name+']';
										
										if(process.env.PROFILING_ENV && this.logger) this.profile(profile);
										
										//callback(err, resp, body, {options: merged, uri: options.uri, route: route.path });
										callback(err, resp, {uri: options.uri, route: route.path });
										
										if(process.env.PROFILING_ENV && this.logger) this.profile(profile);
										
									}.bind(this))
								}
									
								
									
							}.bind(this);
							
							let uri = url.parse(options.uri);
							//let uri_search = null;
							let readonly = false;
							let mailbox_params = {};
							
							let mailbox = ((uri.pathname != null) ? uri.pathname : this.options.mailbox).trim().replace(/\/$/, '');
							
							debug_internals('url->parse %o', uri);
							debug_internals('url->path %o', uri.pathname);
							
							debug_internals('selected box %s', mailbox);
							
							if(uri.search){
								debug_internals('url->search %o', uri.search);
								
								let re = new RegExp(/readonly/ig);
								
								new URLSearchParams(uri.search).forEach((value, name) => {
									if(re.test(name)){
										readonly = (value == 'true') ? true : false;
									}
									else{
										mailbox_params[name] = value;
									}
								});
								//uri_params = 
								debug_internals('Mailbox readonly %o', readonly);
								debug_internals('URLSearchParams (BOX) %o', mailbox_params);
							}
							
							
							
							var req_func = this.request;
							
							let open_mailbox_exec = function () {//try to open mailbox & exec VERB on succsess
								let args = [];
								let cb = function(err, mailbox){
									if (err){
										response(err, null);
									}
									else{
										debug_internals('Mailbox opened %o', mailbox);
										
										let capture_mails = function(f){
											let messages = [];
											
											f.on('message', function(msg, seqno) {
												//console.log('Message #%d', seqno);
												debug_internals('Message %d', seqno);
												debug_internals('Message %o', msg);
												
												let comple_message = {};
												
												var prefix = '(#' + seqno + ') ';
												msg.on('body', function(stream, info) {
													var buffer = '';
													stream.on('data', function(chunk) {
														buffer += chunk.toString('utf8');
													});
													stream.once('end', function() {
														//console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
														debug_internals(prefix + 'Parsed header: %o', Imap.parseHeader(buffer));
														
														comple_message.body = buffer;
													});
												});
												msg.once('attributes', function(attrs) {
													//console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
													debug_internals(prefix + 'Attributes: %o', attrs);
													comple_message.attributes = attrs;
												});
												msg.once('end', function() {
													//console.log(prefix + 'Finished');
													debug_internals(prefix + 'Finished');
													
													messages.push(comple_message);
												});
											});
											f.once('error', function(err) {
												//console.log('Fetch error: ' + err);
												debug_internals('Fetch error: %s', err);
												
												response(err, messages);
											});
											f.once('end', function() {
												//console.log('Done fetching all messages!');
												debug_internals('Done fetching all messages!');
												
												response(null, messages);
											});
										};
										
										let verb_args = [];
										
										if(options.opts)
											verb_args.push(options.opts);
										
										let re = new RegExp(/fetch/ig);
										if(!re.test(verb))	//functions that needs and event (like fetch.on('message', ...))
											verb_args.push(response);
										
										if(verb_args.length == 0)
											verb_args = null;
										
										if(verb_args.length == 1)
											verb_args = verb_args[0];
											
										debug_internals('verb %s', verb);
										debug_internals('arguments %o', verb_args);
										
										let f = null;
										
										if(verb.indexOf('seq.') > -1){//seq counterpart method to normal search, fetch...
											
											let method = verb.split('.', 2)[1];
											f = req_func.seq[method].attempt(verb_args, req_func);
											
											if(verb == 'seq.fetch'){
												capture_mails(f);
											}
											
											debug_internals('sequence verb %s', method);
										}
										else{
											f = req_func[verb].attempt(verb_args, req_func);
											
											if(verb == 'fetch'){
												capture_mails(f);
											}
										}
										
										//if(verb == 'fetch' || verb == 'seq.fetch'){	//functions that needs and event (like fetch.on('message', ...))
										//}//end if(verb == 'fetch')
										
									}
								};
								
								args.push(mailbox);
								args.push(readonly);
								if(mailbox_params.length > 0)
									args.push(mailbox_params);
									
								args.push(cb);
								
								req_func.openBox.attempt(args, req_func);
								
							}
							
							req_func.once('ready', open_mailbox_exec);
							
							if(req_func.state == 'authenticated')
								open_mailbox_exec();
							
							
						}
						
					}.bind(this));
					
					if(!uri_matched)
						throw new Error('No routes matched for URI: '+uri+path+options.uri);
				}
				else{
					////console.log(routes);
					throw new Error('No routes defined for method: '+verb.toUpperCase());
					
				}
				
				////console.log('returning...', request);
				
				//return request;
				
			}.bind(this, verb, this[verb]);//copy the original function if there are func like this.get, this.post, etc
			
		}.bind(this));
		
	},
	use: function(mount, app){
		//debug('use %o', app);
		debug('use instanceOf(app, AppImapClient) %o', instanceOf(app, AppImapClient));
		//console.log(instanceOf(app, AppImapClient));
		
		if(instanceOf(app, AppImapClient) === true)
			this.parent(mount, app);
			
		
	},
	load: function(wrk_dir, options){
		options = options || {};
		
		var get_options = function(options){
			options.scheme = options.scheme || this.options.scheme;
			//options.url = options.url || this.options.url;
			//options.port = options.port || this.options.port;
			//options.authentication = options.authentication || this.options.authentication;
			//options.jar = options.jar || this.options.jar;
			//options.gzip = options.gzip || this.options.gzip;
			
			//options.cradle = options.cradle || this.options.cradle;
			options.host = options.host || this.options.host;
			options.port = options.port || this.options.port;
			options.opts = options.opts || this.options.opts;
			
			/**
			 * subapps will re-use main app logger
			 * */
			
			if(this.logger)	
				options.logs = this.logger;
			
			////console.log(this.request);
			
			//if(this.request)
				//options.cradle = this.request;
			//options.cradle = null;
			
			return options;
		
		}.bind(this);
		
		this.parent(wrk_dir, get_options(options));
		
		
	},
  
	
});

module.exports = AppImapClient;
