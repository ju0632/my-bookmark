app.controller('homeCtr', ['$scope', '$stateParams', '$filter', '$state', '$window', 'pubSubService', 'dataService', function ($scope, $stateParams, $filter, $state, $window, pubSubService, dataService) {
  console.log('Hello homeCtr......');
  if (dataService.smallDevice()) {
    $window.location = "http://m.mybookmark.cn/#/tags";
    return;
  }

  (async () => {
    try {
      await get('user');
      pubSubService.publish('loginCtr.login', { 'login': true });
      $state.go('tags');
    } catch (error) {
      pubSubService.publish('Common.menuActive', {
        login: false,
        index: dataService.NotLoginIndexHome
      });
    }
  })();
  
}]);
