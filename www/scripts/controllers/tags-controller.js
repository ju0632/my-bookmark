app.controller('tagsCtr', ['$scope', '$filter', '$state', '$window', '$stateParams', '$timeout', '$document', 'ngDialog', 'pubSubService', 'dataService', function ($scope, $filter, $state, $window, $stateParams, $timeout, $document, ngDialog, pubSubService, dataService) {
  console.log("Hello tagsCtr...", $stateParams);
  if (dataService.smallDevice()) {
    $window.location = "http://m.mybookmark.cn/#/tags";
    return;
  }

  (async () => {
    await getTags();
  })()

  var dialog = null;
  var addBookmarkId = -1;
  $scope.hoverBookmark = null;
  $scope.showType = "createdAt";
  $scope.loading = false;
  $scope.loadTags = false;
  $scope.tags = []; // 书签数据
  $scope.tagsIndex = []; // 书签索引
  $scope.bookmarks = [];
  $scope.totalPages = 0;
  $scope.currentPage = 1;
  $scope.inputPage = '';
  $scope.currentTagId = ($stateParams && $stateParams.tagId) || (-1);
  $scope.editMode = false;
  $scope.showMode = 'item';
  $scope.newTag = '';
  $scope.waitDelTag = {};
  $scope.waitDelBookmark = {};
  $scope.bookmarkNormalHover = false;
  var timeagoInstance = timeago();

  pubSubService.subscribe('MenuCtr.tags', $scope, function (event, data) {
    console.log('subscribe MenuCtr.tags', data);
    getTags();
  });

  $scope.getBookmarks = async function (tagId, page, showType) {
    console.log(tagId, page, showType);

    $scope.bookmarks = [];
    tagId && ($scope.currentTagId = tagId);
    page && ($scope.currentPage = page);
    showType && ($scope.showType = showType);
    $scope.loading = true;

    let pageSize = ($scope.showMode == 'item') ? 50 : 20;

    for (let tag of $scope.tags) {
      tag.bookmarkClicked = (tag.id == $scope.currentTagId);
    }

    var params = {
      tagId: $scope.currentTagId,
      page: $scope.currentPage,
      pageSize,
      showType: $scope.showType
    };

    let reply = await get('bookmarksByTag', params);
    $scope.bookmarks = reply.data;
    $scope.totalPages = reply.totalPages;
    $scope.inputPage = '';
    $scope.loading = false;

    for (let tag of $scope.tags) {
      if (tag.id == $scope.currentTagId) {
        tag.bookmarkCount = reply.count;
      }
    }

    pubSubService.publish('Common.menuActive', {
      login: true,
      index: dataService.LoginIndexTags
    });

    $timeout(function () {
      dataService.transition('#' + addBookmarkId, {
        duration: 1000,
      });
      addBookmarkId = -1;
    }, 1000);
  };

  $scope.changeCurrentPage = function (currentPage) {
    currentPage = parseInt(currentPage) || 0;
    console.log(currentPage);
    if (currentPage <= $scope.totalPages && currentPage >= 1) {
      $scope.getBookmarks(null, currentPage, null);
      $scope.currentPage = currentPage;
    }
  }

  $scope.jumpToUrl = async function (url, id) {
    if (!$scope.editMode) {
      $window.open(url, '_blank');
      await post("bookmarkClick", { id });

      $scope.bookmarks.forEach(function (bookmark, index) {
        if (bookmark.id == id) {
          bookmark.click_count += 1;
          bookmark.last_click = $filter("date")(new Date(), "yyyy-MM-dd HH:mm:ss");
        }
      })
      $timeout(function () {
        timeagoInstance.cancel();
        timeagoInstance.render(document.querySelectorAll('.need_to_be_rendered'), 'zh_CN');
      }, 100)
    }
  }

  $scope.delBookmark = function (bookmark) {
    $scope.waitDelBookmark = $.extend(true, {}, bookmark); // 利用jQuery执行深度拷贝
    console.log(JSON.stringify(bookmark));
    dialog = ngDialog.open({
      template: './views/dialog-del-bookmark.html',
      className: 'ngdialog-theme-default',
      scope: $scope
    });
  }

  $scope.confirmDelBookmark = async function (id) {
    ngDialog.close(dialog);
    await post("bookmarkDel", { id })
    $("#" + id).transition({
      animation: dataService.animation(),
      duration: 500,
      onComplete: function () {
        $("#" + id).remove();
      }
    });

    // 更新分类里面含有书签的数量
    $scope.tags.forEach((tag) => {
      if (tag.id == $scope.waitDelBookmark.tagId) {
        tag.bookmarkCount--;
      }
    })
  }

  $scope.editBookmark = function (id) {
    console.log('publish bookmarksCtr.editBookmark', { id });
    pubSubService.publish('bookmarksCtr.editBookmark', { id });
  }

  $scope.detailBookmark = async function (bookmark) {
    bookmark.own = true;
    pubSubService.publish('TagCtr.showBookmarkInfo', bookmark);
    await post("bookmarkClick", { id: bookmark.id });
  }

  $scope.copy = function (url) {
    dataService.clipboard(url);
  }

  $scope.toggleMode = function (mode) {
    $scope.editMode = mode;
    if (!$scope.editMode) {
      getTags();
    } else {
      $('.js-tags-table').transition('hide');
      $('.js-tag-costomTag').transition('hide');
      $('.stackable.cards .card').transition('hide');
      $('.stackable.cards .card').transition({
        animation: dataService.animation(),
        reverse: 'auto', // default setting
        interval: 50
      });
    }
  }

  $scope.toggleShowMode = function (showMode) {
    $scope.showMode = showMode;
    $scope.getBookmarks(null, 1, null);
  }

  $scope.editTag = function (tag) {
    if (tag.name == "未分类" || tag.name == "收藏") {
      toastr.warning('这个是系统默认分类，暂时不允许更新名字！', "警告");
      return;
    }
    tag.oldName = tag.name;
    tag.edit = true;
  }

  $scope.updateTagShow = async function (tag, show) {
    await post("tagUpdate", { id: tag.id, show });
    toastr.success(tag.name + ' 更新成功！', "提示");
    $timeout(() => {
      tag.show = show;
    });
  }

  $scope.updateTag = async function (tag) {
    if (tag.name == tag.oldName) {
      toastr.warning('您没有编辑分类', "警告");
    } else {
      tag.edit = false;
      var params = {
        id: tag.id,
        name: tag.name,
      }

      try {
        await post('tagUpdate', params);
        toastr.success(tag.name + ' 更新成功！', "提示");
      } catch (error) {
        $scope.backTag(tag);
      }
    }
  }

  $scope.delTag = function (tag) {
    console.log('delTag..........')
    $scope.waitDelTag = $.extend(true, {}, tag); // 利用jQuery执行深度拷贝
    dialog = ngDialog.open({
      template: './views/dialog-del-tag.html',
      className: 'ngdialog-theme-default',
      scope: $scope
    });
  }

  $scope.confirmDelTag = async function (id, tagName) {
    ngDialog.close(dialog);
    if (tagName == '未分类' || tagName == "收藏") {
      toastr.error('默认分类不允许删除', "提示");
    } else {
      await post("tagDel", { id });

      let index = 0;
      for (const tag of $scope.tags) {
        if (tag.id == id) {
          $("#tag" + id).transition({
            animation: dataService.animation(),
            duration: 500,
            onComplete: function () {
              $("#tag" + id).remove();
              $scope.tags.splice(index, 1);
            }
          });
          break;
        }
        index++;
      }

      getTags();
    }
  }

  $scope.showAddTag = function () {
    if ($scope.tags.length < 30) {
      console.log('showAddTag..........')
      $scope.newTag = "";
      dialog = ngDialog.open({
        template: './views/dialog-add-tag.html',
        className: 'ngdialog-theme-default',
        scope: $scope
      });
    } else {
      toastr.error('标签个数总数不能超过30个！不允许再添加新分类，如有需求，请联系管理员。', "提示");
    }
  }

  $scope.addTag = async function (tag) {
    console.log(tag);
    if ($scope.tags.length >= 30) {
      toastr.error('标签个数总数不能超过30个！不允许再添加新分类，如有需求，请联系管理员。', "提示");
      return;
    }
    tag = tag.replace(/(^\s*)|(\s*$)/g, '').replace(/\s+/g, ' '); // 去除前后空格，多个空格转为一个空格;

    var exist = $scope.tags.some((item) => {
      return item.name == tag;
    })
    if (exist) {
      toastr.error('该分类【' + tag + '】已存在！', "提示");
      return;
    }

    if (tag) {
      ngDialog.close(dialog);
      await post("tagAdd", { name: tag })
    } else {
      toastr.warning('您可能没有输入分类或者输入的分类有误', "提示");
    }
  }

  $scope.backTag = function (tag) {
    tag.edit = false;
    tag.name = tag.oldName;
  }

  $scope.storeTagIndex = function () {
    $scope.tagsIndex = [];
    $scope.tags.forEach((tag, index) => {
      $scope.tagsIndex[index] = {
        id: tag.id,
        sort: index,
      }
    })
  }

  $scope.updateTagIndex = async function () {
    // 要开个timer，因为释放鼠标模型还没更新
    setTimeout(async () => {
      let needUpdate = false;
      for (let index = 0; index < $scope.tags.length; index++) {
        if ($scope.tags[index].id != $scope.tagsIndex[index].id) {
          needUpdate = true;
        }
        $scope.tagsIndex[index] = {
          id: $scope.tags[index].id,
          sort: index,
        }
      }
      if (needUpdate) {
        await post('tagSort', { tags: $scope.tagsIndex });
      }
    }, 300)
  }

  $scope.setHoverBookmark = function (bookmark) {
    $scope.hoverBookmark = bookmark;
  }

  // 在输入文字的时候也会触发，所以不要用Ctrl,Shift之类的按键
  $document.bind("keydown", function (event) {
    $scope.$apply(function () {
      var key = event.key.toUpperCase();
      if ($scope.hoverBookmark && dataService.keyShortcuts()) {
        if (key == 'E') {
          $scope.editBookmark($scope.hoverBookmark.id)
        } else if (key == 'I') {
          $scope.detailBookmark($scope.hoverBookmark)
        } else if (key == 'D') {
          $scope.delBookmark($scope.hoverBookmark)
        } else if (key == 'C') {
          $scope.copy($scope.hoverBookmark.url)
        }
      }
    })
  });

  async function getTags() {
    $scope.loadTags = true;
    $scope.tags = [];

    let tags = await get('tags', { bookmarkCount: true });
    tags.unshift({
      id: -1,
      bookmarkCount: 1,
      bookmarkClicked: false,
      name: '个人定制',
      show: 1
    })

    let find = false;
    for (let tag of tags) {
      tag.edit = false;
      tag.oldName = tag.name;
      if (tag.id == $scope.currentTagId) {
        tag.bookmarkClicked = true;
        find = true; // 如果是删了分类返回来，那么要重新默认选中第一个分类
      }
      $scope.tags.push(tag);
    }

    if (!find) {
      $scope.currentTagId = -1;
      $scope.tags[0].bookmarkClicked = true;
    }

    if (!$scope.editMode) {
      await $scope.getBookmarks(null, null, null);
    }

    $scope.loadTags = false;
    pubSubService.publish('Common.menuActive', {
      login: true,
      index: dataService.LoginIndexTags
    });
  }

  pubSubService.subscribe('EditCtr.inserBookmarsSuccess', $scope, function (event, data) {
    console.log('subscribe EditCtr.inserBookmarsSuccess', data);
    var menusScope = $('div[ng-controller="menuCtr"]').scope();
    if (menusScope.login && menusScope.selectLoginIndex == 1) {
      var find = false;
      $scope.bookmarks.forEach((bookmark) => {
        if (bookmark.id == data.id) {
          bookmark.title = data.title;
          bookmark.url = data.url;
          bookmark.description = data.description;
          find = true;
        }
      })
      if (!find) {
        if ($scope.tags.map((tag) => tag.id).indexOf($scope.currentTagId) >= 0) {
          if (!$scope.editMode) {
            $scope.getBookmarks(null, null, null);
          }
          addBookmarkId = data.id;
        }
      }
    }
  });

  pubSubService.subscribe('EditCtr.addTagsSuccess', $scope, function (event, data) {
    console.log('subscribe EditCtr.addTagsSuccess', data);

    var menusScope = $('div[ng-controller="menuCtr"]').scope();
    if (menusScope.login && menusScope.selectLoginIndex == 1) {
      getTags();
    }
  });

  setTimeout(() => {
    $('.js-tag-label .icon').popup();
  }, 3000);
}]);