app.controller('noteCtr', ['$scope', '$state', '$stateParams', '$filter', '$window', '$timeout', '$document', 'ngDialog', 'pubSubService', 'dataService', function ($scope, $state, $stateParams, $filter, $window, $timeout, $document, ngDialog, pubSubService, dataService) {
  console.log("Hello noteCtr...", $stateParams);
  if (dataService.smallDevice()) {
    $window.location = "http://m.mybookmark.cn/#/tags";
    return;
  }

  const perPageItems = 35;
  var dialog = null;
  $scope.hoverNote = null;
  $scope.loadBusy = false;
  $scope.add = false;
  $scope.edit = false;
  $scope.preContent = '';
  $scope.content = '';
  $scope.currentTagId = null;
  $scope.currentNoteId = null;
  $scope.tags = []; // 书签数据
  $scope.notes = [];
  $scope.totalPages = 0;
  $scope.currentPage = 1;
  $scope.inputPage = '';
  $scope.keyword = $stateParams.keyword
  $scope.key = $stateParams.key
  $scope.totalItems = 0;

  var timeagoInstance = timeago();

  get('user').then(user => {
    pubSubService.publish('Common.menuActive', {
      login: true,
      index: dataService.LoginIndexNote
    });
    getTags();
    getNotes();
  });

  $scope.changeCurrentPage = function (currentPage) {
    currentPage = parseInt(currentPage) || 0;
    if (currentPage <= $scope.totalPages && currentPage >= 1) {
      $scope.currentPage = currentPage;
      $scope.inputPage = '';
      getNotes();
    } else {
      $scope.currentPage = $scope.totalPages
    }
  }

  // 快捷键a增加书签
  $document.bind("keydown", function (event) {
    $scope.$apply(function () {
      // a按键，显示
      var key = event.key.toUpperCase();
      if (key == 'A' && dataService.keyShortcuts() && (!$scope.add)) {
        $scope.showAddNote();
      }
    })
  });

  $scope.showAddNote = function () {
    $scope.add = (!$scope.add);
    $scope.edit = false;
    $scope.content = '';
    if ($scope.add) {
      $timeout(function () {
        $("#noteedit")[0].focus();
      });
    }
    console.log('$scope.showAddNote');
    // 没有选中分类，默认一个分类
    if (!$scope.currentTagId) {
      $scope.tags.forEach((tag) => {
        tag.clicked = false;
        if (tag.name == '未分类') {
          $scope.currentTagId = tag.id;
          tag.clicked = true;
        }
      })
    }
  }

  $scope.addNote = async function (close) {
    if ($scope.content == '') {
      toastr.error('不允许备忘录内容为空！', "提示");
      return;
    }
    if ($scope.preContent == $scope.content) {
      toastr.error('您刚刚添加了这条内容！', "提示");
      return;
    }
    $scope.add = close;
    var tagName = '';

    $scope.tags.forEach((tag) => {
      if ($scope.currentTagId === tag.id) {
        tagName = tag.name;
        tag.noteCount += 1;
      }
      if (!$scope.currentTagId) {
        if (tag.name == '未分类') {
          $scope.currentTagId = tag.id;
          tagName = tag.name
        }
      }
    })

    var note = {
      tagId: $scope.currentTagId,
      content: $scope.content,
    }

    await post("noteAdd", note);

    // 增加成功，重新获取一次备忘录
    $scope.tags.forEach((tag) => {
      tag.clicked = false;
    })
    $scope.preContent = $scope.content;
    $scope.content = '';
    $scope.currentTagId = null;
    $scope.currentPage = 1;
    $scope.keyword = '';
    getNotes();
  }

  $scope.copy = function (content, $event) {
    dataService.clipboard(content);
    $event && $event.stopPropagation();
  }

  $scope.delNote = function (id, content) {
    $scope.currentNoteId = id;
    $scope.content = content;
    var width = content.length >= 500 ? "50%" : "30%";
    dialog = ngDialog.open({
      template: './views/dialog-del-note.html',
      className: 'ngdialog-theme-default',
      width: width,
      scope: $scope
    });
  }

  $scope.confirmDelNote = async function () {
    if ($scope.currentNoteId) {
      var params = {
        id: $scope.currentNoteId
      }
      ngDialog.close(dialog);
      await post('noteDel', params)
      $("#" + $scope.currentNoteId).transition({
        animation: dataService.animation(),
        duration: 500,
        onComplete: function () {
          $("#" + $scope.currentNoteId).remove();
        }
      });
      $scope.totalItems -= 1;
    } else {
      toastr.error('删除失败！请刷新页面再尝试', "提示");
    }
  }

  $scope.editNote = function (id, content, tagId) {
    $scope.add = true;
    $scope.edit = true;
    $scope.content = content;
    $scope.currentNoteId = id;
    $scope.currentTagId = tagId;
    updateSelectTag(tagId);
  }

  $scope.updateNote = async function () {
    if (!$scope.content) {
      toastr.error('更新失败，更新内容不能为空', "提示");
      return;
    }
    var tagName = '';
    $scope.tags.forEach((tag) => {
      if ($scope.currentTagId === tag.id) {
        tagName = tag.name;
      }
      if (!$scope.currentTagId) {
        if (tag.name == '未分类') {
          $scope.currentTagId = tag.id;
          tagName = tag.name
        }
      }
    })

    var params = {
      id: $scope.currentNoteId,
      content: $scope.content,
      tagId: $scope.currentTagId,
    }

    await post("noteUpdate", params);
    $scope.notes.forEach((note) => {
      if (note.id == $scope.currentNoteId) {
        note.content = $scope.content;
        note.tagName = tagName;
        note.tag_id = $scope.currentTagId;
        toPos(note.id);
      }
    })
    $scope.add = false;
    $scope.edit = false;
  }

  $scope.detailNote = function (content) {
    $scope.content = content;
    var width = content.length >= 500 ? "50%" : "30%";
    dialog = ngDialog.open({
      template: './views/dialog-detail-note.html',
      className: 'ngdialog-theme-default',
      width: width,
      scope: $scope
    });
  }

  $scope.closeNote = function () {
    $('.js-note').transition({
      animation: dataService.animation(),
      duration: '500ms',
      onComplete: function () {
        $(".js-note").remove();
      }
    });
  }

  $scope.setHoverNote = function (note) {
    $scope.hoverNote = note;
  }

  $scope.clickTag = function (id) {
    $scope.currentTagId = id;
    $scope.totalItems = 0;
    updateSelectTag(id);

    if ($scope.add || $scope.edit) {

    } else {
      $scope.currentPage = 1;
      getNotes($scope.currentTagId);
    }
  }

  $scope.noteClick = function (note, flag, $event) {
    if (!note.detail || flag) {
      var detail = note.detail;
      $scope.notes.forEach((note) => {
        note.detail = false;
        $("#" + note.id).removeClass("secondary");
      })
      note.detail = !detail;
      note.detail && $("#" + note.id).addClass("secondary") && toPos(note.id);
    }
    if (flag) {
      $event && $event.stopPropagation();
    }
  }

  $scope.share = function (note) {
    var time = 100;
    if (note.public == '0') {
      toastr.info('由于打算分享备忘，系统会自动将备忘的私密状态转为公开状态');
      $scope.updatePublic(note, '1');
      time = 1000;
    }
    setTimeout(() => {
      dataService.clipboard(`https://mybookmark.cn/api/notes/?shareNote=${note.id}`);
      toastr.info(`将地址 https://mybookmark.cn/api/notes/?shareNote=${note.id} 发给别人粘贴到浏览器地址栏就可以访问到你分享的备忘啦！`, "提示");
    }, time)
  }

  $scope.updatePublic = async function (note, public) {
    var params = {
      id: note.id,
      public: public,
    }

    await post("updateNode", params);
    note.public = public;
  }

  function updateSelectTag(tagId) {
    $scope.tags.forEach((tag) => {
      tag.clicked = false;
      if (tag.id == tagId) {
        tag.clicked = true;
        t = tag;
      }
    })
  }

  // 在输入文字的时候也会触发，所以不要用Ctrl,Shift之类的按键
  $document.bind("keydown", function (event) {
    $scope.$apply(function () {
      var key = event.key.toUpperCase();
      if ($scope.hoverNote && dataService.keyShortcuts()) {
        if (key == 'E') {
          $scope.editNote($scope.hoverNote.id, $scope.hoverNote.content, $scope.hoverNote.tag_id)
        } else if (key == 'I') {
          $scope.detailNote($scope.hoverNote.content)
        } else if (key == 'D') {
          $scope.delNote($scope.hoverNote.id, $scope.hoverNote.content)
        } else if (key == 'C') {
          $scope.copy($scope.hoverNote.content)
        }
      }
    })
  });

  async function getNotes(tagId) {
    $scope.notes = [];
    $scope.loadBusy = true;
    var params = {
      page: $scope.currentPage,
      pageSize: perPageItems,
      keyword: $scope.keyword,
      tagId: tagId || $scope.currentTagId
    };

    try {
      let reply = await get("notes", params);
      $scope.notes = reply.data;
      $scope.notes.forEach((note) => {
        note.brief = note.content || "";
        while (note.brief.indexOf("\n") > 0) {
          note.brief = note.brief.replace(/\n/g, "");
        }
        note.brief = "       " + note.brief.substring(0, 200) + (note.content.length > 200 ? " ......" : "");
      })
      $scope.totalPages = reply.totalPages;
      $scope.totalItems = reply.count;
      $timeout(function () {
        timeagoInstance.cancel();
        timeagoInstance.render(document.querySelectorAll('.need_to_be_rendered'), 'zh_CN');
        // 如果需要增加书签
        if ($scope.key == 'A') {
          $scope.key = null;
          $scope.showAddNote();
        }
      }, 100)
      $scope.loadBusy = false;
      if ($scope.totalItems == 0) {
        $(".js-note").removeClass("hidden");
      }
      transition();
    } catch (error) {
      $scope.notes = [];
      $scope.loadBusy = false;
    }
  }

  async function getTags() {
    $scope.loadBusy = true;
    $scope.tags = []

    let tags = await get('tags', { noteCount: true });
    let find = false;
    tags.forEach((tag) => {
      $scope.tags.push(tag);
      if (tag.id == $scope.currentTagId) {
        find = true; // 如果是删了分类返回来，那么要重新默认选中第一个分类
      }
    })
    if (!find) $scope.currentTagId = null;
    $scope.loadBusy = false;
  }

  $('.js-note-card').transition('hide');

  function transition() {
    var className = 'js-note-card';
    $('.' + className).transition('hide');
    $('.' + className).transition({
      animation: dataService.animation(),
      duration: 500,
    });
  }

  function toPos(id) {
    setTimeout(function () {
      $('html,body').animate({ scrollTop: $('#' + id).offset().top - 20 }, 100);
    }, 36);
  }
}]);