'use strict'

var App = require('node-app'),
		path = require('path'),
		fs = require('fs'),
		//Imap = require('node-imap-client'),
		pathToRegexp = require('path-to-regexp'),
		Imap = require('imap');
		

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
		 
	 /**
		* fetch(< MessageSource >source, [< object >options]) - ImapFetch - Fetches message(s) in the currently open mailbox.
		* */
		'fetch',


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
			
			this.fireEvent(this.ON_CONNECT_ERROR, {uri: options.uri, route: route.path, error: err });
			
		});

		this.request.once('end', function() {
			debug_internals('connection ended');
			
			this.fireEvent(this.ON_CONNECT_ERROR, {host: this.options.host, user: this.options.opts.user, error: new Error('Connection ended.') });
			
		}.bind(this));
		
		this.request.once('ready', function() {
			debug_internals('connection ready');
			
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
								
								////console.log('---req_func.cache.has(options.doc)---')	
								////console.log(resp._id);
								////console.log(this.request.database('dashboard').cache.has(resp._id));
								
								//console.log('--response callback---');
								//console.log(arguments);
								
								//if(resp == false){
									//debug_internals('response connection closed');
									////this.request.disconnect();
									////this.fireEvent(this.ON_CONNECT_ERROR, { error: resp });
								//}
								//else 
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
							
							var args = [];
							
							if(options.uri != '')
								args.push(options.uri);
								
							//if(options.id)
								//args.push(options.id);
							
							//if(options.rev)
								//args.push(options.rev);
							
							//if(options.data)
								//args.push(options.data);
									
							
							//var req_func = null;
							//var db = keys[0];
							//var cache = keys[1];
							//var cache_result;
							
							//if(db){
								//var name = re.exec(options.uri)[1];
								//req_func = this.request['database'](name);
								////console.log('---DB----');
								////console.log(name);
								//////console.log(req_func['info'](response));
							//}
							//else{
								//////console.log(this.request);
								//var req_func = new Imap(this.options.host, this.options.port);
								var req_func = this.request;
								
							//}
							
							
							
							//if(!cache || (!cache_result && cache.optional)){
								//console.log('---NO CACHE----');
								
								args.push(response);
								
								//////console.log(req_func[verb](args[0]))
								
								
							
								if(args.length == 0)
									args = null;
								
								if(args.length == 1)
									args = args[0];
								
								debug_internals('verb %s', verb);
								debug_internals('arguments %o', args);
								//console.log(args);
								////console.log(verb);
								////console.log(conn);
								
								//req_func['connect'](function(client){
									//console.log(client);
									//console.log(typeOf(client));
									//if(typeOf(client) != 'object' || client == false){
										//debug_internals('connect error %o', client);
										//this.fireEvent(this.ON_CONNECT_ERROR, {error: client });
									//}
									//else{
										
										//req_func[verb].attempt(response, req_func);
										
										req_func[verb].attempt(args, req_func);
										//try{
										
										//debug_internals('%o', req_func[ver]);
										
											//req_func[verb](response);
										//}
										//catch(e){
											//console.log(e);
										//}
									//}
										
								//}.bind(this));	
								
								
								
							//}
							
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
