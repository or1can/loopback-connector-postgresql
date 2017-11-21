// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: loopback-connector-postgresql
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';
var should = require('should'),
  assert = require('assert');
var InvalidDefault, Post, db;

describe('autoupdate', function() {
  describe('database default field values', function() {
    before(function() {
      db = getDataSource();

      Post = db.define('PostWithDbDefaultValue', {
        created: {
          type: 'Date',
          postgresql: {
            dbDefault: 'now()',
          },
        },
        defaultInt: {
          type: 'Number',
          postgresql: {
            dbDefault: '5',
          },
        },
        oneMore: {
          type: 'Number',
        },
      });

      InvalidDefault = db.define('PostWithInvalidDbDefaultValue', {
        created: {
          type: 'Date',
          postgresql: {
            dbDefault: '\'5\'',
          },
        },
      });
    });

    it('should run migration', function(done) {
      db.automigrate('PostWithDbDefaultValue', function() {
        done();
      });
    });

    it('should report inconsistent default values used', function(done) {
      db.automigrate('PostWithInvalidDbDefaultValue', function(err) {
        should.exists(err);
        // XXX(kjdelisle): The InvalidDefaults test is polluting the default date
        // types of the other tests!
        delete db.connector._models.PostWithInvalidDbDefaultValue;
        done();
      });
    });

    it('should have \'now()\' default value in SQL column definition',
      function(done) {
        var query = 'select column_name, data_type, character_maximum_length,' +
          ' column_default' +
          ' from information_schema.columns' +
          " where table_name = 'postwithdbdefaultvalue'" +
          " and column_name='created'";

        function verifyColumnDefault() {
          db.connector.execute(query, [], function(err, results) {
            assert.equal(results[0].column_default, 'now()');
            done(err);
          });
        }

        if (db.connected) {
          verifyColumnDefault();
        } else {
          db.once('connected', verifyColumnDefault);
        }
      });

    it('should create a record with default value', function(done) {
      Post.create({oneMore: 3}, function(err, p) {
        should.not.exists(err);
        Post.findOne({where: {defaultInt: 5}}, function(err, p) {
          should.not.exists(err);
          should.exists(p);
          p.should.have.property('defaultInt', 5);
          done();
        });
      });
    });

    it('should create a record with custom value', function(done) {
      Post.create({oneMore: 2, defaultInt: 6}, function(err, p) {
        should.not.exists(err);
        Post.findOne({where: {defaultInt: 6}}, function(err, p) {
          should.not.exists(err);
          should.exists(p);
          p.should.have.property('defaultInt', 6);
          done();
        });
      });
    });
  });

  describe('should update an existing default value', function() {
    var properties, SimpleEmployee;

    before(function(done) {
      properties = {
        string: {
          type: String,
          default: null,
        },
        number: {
          type: Number,
          default: null,
        },
      };
      SimpleEmployee = db.define('SimpleEmployee', properties);
      db.automigrate(done);
    });

    after(function(done) {
      SimpleEmployee.destroyAll(done);
    });

    it('get old model defaults', function(done) {
      db.discoverModelProperties('simpleemployee', {schema: 'public'},
        function(err, props) {
          assert(!err);
          assert.equal(props[0].default, null);
          assert.equal(props[1].default, null);
          done();
        });
    });

    it('perform autoupdate and get new model defaults', function(done) {
      properties.string.default = '{}';
      properties.number.default = 5;
      SimpleEmployee = db.define('SimpleEmployee', properties);
      db.autoupdate(function(err) {
        assert(!err);
        db.discoverModelProperties('simpleemployee', {schema: 'public'},
          function(err, props) {
            assert(!err);
            assert.equal(props[0].default, "'{}'::text");
            assert.equal(props[1].default, 5);
            done();
          });
      });
    });
  });

  describe('should remove an existing default value', function() {
    var properties, SimpleEmployee;

    before(function(done) {
      properties = {
        string: {
          type: String,
          default: '{}',
        },
        number: {
          type: Number,
          default: 5,
        },
      };
      SimpleEmployee = db.define('SimpleEmployee', properties);
      db.automigrate(done);
    });

    after(function(done) {
      SimpleEmployee.destroyAll(done);
    });

    it('get old model defaults', function(done) {
      db.discoverModelProperties('simpleemployee', {schema: 'public'},
        function(err, props) {
          assert(!err);
          assert.equal(props[0].default, "'{}'::text");
          assert.equal(props[1].default, 5);
          done();
        });
    });

    it('perform autoupdate and get new model defaults', function(done) {
      delete properties.string.default;
      delete properties.number.default;
      SimpleEmployee = db.define('SimpleEmployee', properties);
      db.autoupdate(function(err) {
        assert(!err);
        db.discoverModelProperties('simpleemployee', {schema: 'public'},
          function(err, props) {
            assert(!err);
            assert.equal(props[0].default, null);
            assert.equal(props[1].default, null);
            done();
          });
      });
    });
  });
});
