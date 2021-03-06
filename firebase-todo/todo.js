var app = angular.module('todo', ['OmniBinder']);

app.service('firebase', function (obBinderTypes, $parse) {

  this.subscribe = function (binder) {
    binder.fbRef = new Firebase(binder.query.url);

    if (binder.type === obBinderTypes.COLLECTION) {
      binder.fbRef.on('child_added', function (snapshot, prev) {
        var index, snap = snapshot.val();
        console.log('child_added', snap);

        if (binder.key) snap[binder.key] = snapshot.name();

        if (isWaitingForId(binder, snap)) {

          binder.onProtocolChange.call(binder, [{
            name: binder.key,
            object: snap,
            type: 'new',
            force: true
          }]);

          return;
        }

        index = getIndexOfItem(binder.scope[binder.model], snapshot.name(), binder.key);
        index = typeof index === 'number' ? index : binder.scope[binder.model].length;

        binder.onProtocolChange.call(binder, [{
          addedCount: 1,
          added: [snap],
          index: index,
          removed: []
        }]);
      });

      binder.fbRef.on('child_removed', function (snapshot, prev) {
        var index = getIndexOfItem(binder.scope[binder.model], snapshot.name(), binder.key);

        if (typeof index !== 'number') return;

        var change = {
          removed: [snapshot.val()],
          addedCount: 0,
          index: index
        };

        binder.onProtocolChange.call(binder, [change]);
      });

      binder.fbRef.on('child_changed', function (snapshot) {
        var index, removed, snap = snapshot.val();

        if (binder.key) snap[binder.key] = snapshot.name();

        index = getIndexOfItem(binder.scope[binder.model], snapshot.name(), binder.key);
        index = typeof index === 'number' ? index : binder.scope[binder.model].length;

        removed = angular.copy(binder.scope[binder.model][index]);

        binder.onProtocolChange.call(binder, [{
          index: index,
          addedCount: 1,
          removed: [removed],
          added: [snap]
        }]);
      });

      //TODO: Finish the move implementation
      /*binder.fbRef.on('child_moved', function (snapshot, prev) {
        var snap = snapshot.val(),
            originalIndex = getIndexOfItem(binder.scope[binder.model], snapshot.name(), binder.key),
            newIndex;

        console.log('child_moved', snap, originalIndex);

        if (typeof originalIndex !== 'number') return;

        newIndex = getIndexOfItem(binder.scope[binder.model], prev, binder.key);
        newIndex = newIndex ? newIndex - 1 : 0;

        console.log('newIndex', newIndex);

        binder.onProtocolChange.call(binder, [{
          index: originalIndex,
          addedCount: 0,
          removed: [snap],
          added: []
        }, {
          index: newIndex,
          addedCount: 1,
          removed: [],
          added: [snap]
        }]);
      });*/
    }

    function isWaitingForId (binder, object) {
      var copy = angular.copy(object),
          isWaiting = false;

      delete copy.id;

      angular.forEach(binder.pendingObjects, function (obj, i) {
        if (isWaiting) return;
        if (angular.equals(obj, copy)) {
          binder.pendingObjects.splice(i, 1);
          isWaiting = true;
        }
      });

      return isWaiting;
    }
  };

  this.processChanges = function (binder, delta) {
    var change,
        getter = $parse(binder.model);

    for (var i = 0; i < delta.changes.length; i++) {
      change = delta.changes[i];

      if (change.addedCount) {
        for (var j = change.index; j < change.addedCount + change.index; j++) {
          binder.ignoreNProtocolChanges++;
          processAddedItem(angular.copy(getter(binder.scope)[j]));
        }
      }
    }

    function processAddedItem (model) {
      binder.pendingObjects = binder.pendingObjects || [];
      binder.pendingObjects.push(model);
      binder.fbRef.push(model);
    }
  };

  function getIndexOfItem (list, id, key) {
    var itemIndex;

    angular.forEach(list, function (it, i) {
      if (itemIndex) return;
      if (it && it[key] === id) itemIndex = i;
    });

    return itemIndex;
  }
});

// app.service('deployd', function () {
//   var pendingObjects = [];
//   function waitForId (initialObject) {
//     pendingObjects.push(initialObject);
//   }

//   function isWaitingForId (object) {
//     var copy = angular.copy(object),
//         isWaiting = false;

//     delete copy.id;

//     angular.forEach(pendingObjects, function (obj, i) {
//       if (isWaiting) return;
//       if (angular.equals(obj, copy)) {
//         pendingObjects.splice(i, 1);
//         isWaiting = true;
//       }
//     });

//     return isWaiting;
//   }

//   function getIndexOfItem (list, id) {
//     var itemIndex;

//     angular.forEach(list, function (it, i) {
//       if (itemIndex) return;
//       if (it && it.id === id) itemIndex = i;
//     });

//     return itemIndex;
//   }

//   this.subscribe = function (binder) {
//     dpd[binder.query.collection].get(function (items) {
//       if (!items.length) return;

//       binder.onProtocolChange.call(binder, [{
//         added: items,
//         removed: [],
//         addedCount: items.length,
//         index: 0
//       }]);
//     });

//     function itemUpdated (newItem, force) {
//       var modelCopy = angular.copy(binder.scope[binder.model]),
//           itemIndex = getIndexOfItem(modelCopy, newItem.id);

//       if (typeof itemIndex !== 'number' && !force) {
//         return;
//       }
//       else if (force) {
//         var itemCopy = angular.copy(newItem);
//         delete itemCopy.id;
//         angular.forEach(modelCopy, function (item, i) {
//           if (angular.equals(item, itemCopy)) itemIndex = i;
//         });
//       }
//       var changes = [];

//       //We're generating a change for each key since right now
//       //we don't know which one was actually changed.
//       angular.forEach(Object.keys(newItem), function (key) {
//         changes.push({
//           name: key,
//           object: newItem,
//           type: 'update'
//         });
//       });

//       binder.onProtocolChange.call(binder, changes);
//     }

//     function itemCreated (newItem) {
//       var modelCopy = angular.copy(binder.scope[binder.model]);
//       var itemIndex = getIndexOfItem(modelCopy, newItem.id);
//       //If an item of the same id exists, it obviously is not new.
//       if (typeof itemIndex === 'number') return;

//       if (isWaitingForId(newItem)) {
//         return itemUpdated(newItem, true);
//       }


//       var change = {
//         index: modelCopy.length,
//         added: [newItem],
//         addedCount: 1,
//         removed: []
//       };

//       binder.onProtocolChange.call(binder, [change]);
//     }

//     dpd[binder.query.collection].on('updated', itemUpdated);

//     dpd[binder.query.collection].on('created', itemCreated);

//     dpd[binder.query.collection].on('deleted', function (removedItem) {
//       var modelCopy = angular.copy(binder.scope[binder.model]);
//       var itemIndex = getIndexOfItem(modelCopy, removedItem.id);
//       if (typeof itemIndex !== 'number') return;

//       var change = {
//         removed: [removedItem],
//         addedCount: 0,
//         index: itemIndex
//       };

//       binder.onProtocolChange.call(binder, [change]);
//     })
//   };

//   this.processChanges = function (binder, delta) {
//     delta.changes.forEach(function (change) {
//       if (change.removed) {
//         change.removed.forEach(removeItem);
//       }
//       else if (typeof change.name !== 'undefined') {
//         return processObjectChange(delta);
//       }

//       var modelCopy = binder.scope[binder.model];
//       if (change.addedCount) {
//         for (var i = change.index; i < change.addedCount + change.index; i++) {
//           if (!modelCopy[i].id) {
//             waitForId(angular.copy(modelCopy[i]));
//             dpd[binder.query.collection].post(modelCopy[i]);
//           }
//         }
//       }

//       //It's a one-for-one splice of the same object
//       if (change.removed.length === 1 && change.addedCount === 1 && modelCopy[change.index] && change.removed[0] && modelCopy[change.index].id === change.removed[0].id) {
//         dpd[binder.query.collection].put(modelCopy[i].id, modelCopy[i]);
//       }
//     });

//     function processObjectChange (delta) {
//       angular.forEach(delta.changes, function (change) {
//         dpd[binder.query.collection].put(change.object.id, change.object);
//       });
//     }

//     function removeItem (item) {
//       //Make sure the item wasn't actually just updated.
//       var modelCopy = angular.copy(binder.scope[binder.model]);
//       var itemIndex = getIndexOfItem(modelCopy, item.id);
//       if (typeof itemIndex === 'number' || typeof item.id === 'undefined') return;

//       dpd[binder.query.collection].del(item.id);
//     }
//   };
// });

app.controller('App', function ($scope, obBinderTypes, obBinder, firebase) {
  $scope.items = [];

  var myBinder = obBinder($scope, 'items', firebase, {
    key: 'id',
    query: {
      url: 'http://superheroic.firebaseio.com/items'
    },
    type: obBinderTypes.COLLECTION
  });

  $scope.add = function() {
    $scope.items.push({text: $scope.newText, done: false});
    $scope.newText = '';
  };

  $scope.remaining = function() {
    return $scope.items.reduce(function(count, item) {
      return item.done ? count : count + 1;
    }, 0);
  };

  $scope.archive = function() {
    var item;
    for (var i = 0; i < $scope.items.length; i++) {
      item = $scope.items[i];
      if (item.done) {
        $scope.items.splice(i, 1);
        i--;
      }
    }

  };
});
