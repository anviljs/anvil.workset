/*
	anvil.workset - An anvil core plugin that manages the working set of files in a build
	version:	0.0.4
	author:		Alex Robson <alex@sharplearningcurve.com> (http://sharplearningcurve.com)
	copyright:	2011 - 2012
	license:	Dual licensed
				MIT (http://www.opensource.org/licenses/mit-license)
				GPL (http://www.opensource.org/licenses/gpl-license)
*/
module.exports = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.workset",
		activity: "pull",

		configure: function( config, command, done ) {
			var self = this;
			anvil.on( "file.changed", function( change, path, base ) {
				if( base === anvil.config.spec ) {
					self.handleSpecChange( path, base );
				} else {
					self.handleSourceChange( path, base );
				}
			} );
			anvil.on( "file.deleted", function( change, path, base ) {
				if( base === anvil.config.source ) {
					self['delete']( path );
				}
			} );
			done();
		},

		copy: function( file, done ) {
			var path = anvil.fs.buildPath( [ file.relativePath, file.name ] );
			anvil.log.event( "prepping '" + path + "'" );
			anvil.fs.copy( file.originalPath, [ file.workingPath, file.name ], done );
		},

		"delete": function( path, done ) {
			var file = _.find( anvil.project.files, function( file ) {
							return file.originalPath == path;
						} );
			if( file ) {
				anvil.fs["delete"]( [ file.workingPath, file.name ], function() {
					anvil.log.event( "Deleted " + file.fullPath + " from working path " );
				} );
			}
		},

		handleSourceChange: function( path, base ) {
			var file = _.find( anvil.project.files, function( file ) {
							return file.originalPath == path;
						} );

			if( !file ) {
				file = anvil.fs.buildFileData( base, anvil.config.working, path );
				anvil.project.files.push( file );
			}
			
			this.traceDependents( file, function() {
				anvil.raise( "rebuild", "combine" );
			} );
		},

		handleSpecChange: function( path, base ) {
			var file = _.find( anvil.project.specs, function( file ) {
							return file.originalPath == path;
						} );

			if( !file ) {
				metadata = anvil.fs.buildFileData( base, anvil.config.working, path );
				anvil.project.specs.push( metadata );
			}
			anvil.raise( "rebuild", "test" );
		},

		run: function( done ) {
			var list = [].concat( anvil.project.files ).concat( anvil.project.dependencies );
			anvil.scheduler.parallel( list, this.copy, function() { done(); } );
		},

		traceDependents: function( file, done ) {
			anvil.log.debug( "Tracing " + file.dependents.length + " dependents for " + file.originalPath );
			var self = this,
				copies = _.map( file.dependents, function( dependent ) {
					return function( done ) {
						self.traceDependents( dependent, function() { done(); } );
					};
				} );
			anvil.scheduler.pipeline( undefined, copies, function() {
				file.state = "inProcess";
				var fresh = anvil.fs.buildFileData( anvil.config.source, anvil.config.working, file.originalPath );
				_.each( fresh, function( value, key ) {
					file[ key ] = value;
				} );
				file.dependents = [];
				file.imports = [];
				file.extension();
				self.copy( file, done );
			} );
		}
	} );
};