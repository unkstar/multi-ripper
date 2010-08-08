// ==UserScript==
// @name           Danbooru Ripper
// @namespace      LaurenceVon
// @description    Danbooru Ddownload Helper
// @include        http://danbooru.donmai.us/post?*page=*&tags=*
// @include        http://danbooru.donmai.us/post?*tags=*
// @include        http://danbooru.donmai.us/post/index*
// @include        http://danbooru.donmai.us/pool/show/*
// @include        http://moe.imouto.org/post/*
// @include        http://moe.imouto.org/pool/show/*
// @include        http://gelbooru.com/*
// @include        http://thedoujin.com/index.php?*
// ==/UserScript==
var $;

// Add jQuery
(function() {
  if (typeof unsafeWindow.jQuery == 'undefined') {
    var GM_Head = document.getElementsByTagName('head')[0] || document.documentElement,
    GM_JQ = document.createElement('script');

    GM_JQ.src = 'http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js';
    GM_JQ.type = 'text/javascript';
    GM_JQ.async = true;

    GM_Head.insertBefore(GM_JQ, GM_Head.firstChild);
  }
  GM_wait();
})();

// Check if jQuery's loaded
function GM_wait() {
  if (typeof unsafeWindow.jQuery == 'undefined') {
    window.setTimeout(GM_wait, 100);
  } else {
    $ = unsafeWindow.jQuery.noConflict(true);
    letsJQuery();
  }
}

// All your GM code must be inside this function
function letsJQuery() {
  var dummy = function() {};

  var get_max_page_nums = function() {
    var paginator = $(".pagination>a");
    var max_num = 1; //minimized value to 1, for gelbooru pool analyzing
    paginator.each(function(i, anchor) {
      var curr = parseInt(anchor.innerHTML);
      if (!isNaN(curr) && curr > max_num) {
        max_num = curr;
      }
    });
    return max_num;
  };

  var net_fetcher = function(parser, value, status, make_url) {
    this.val = value;
    var self = this;
    var iteration = function(cur_url, index) {
      status.call(self, "processing page " + index + " , from page " + self.begin + " to " + self.end + " currently "+ self.counter + " pictures url collected!");
      $.ajax({
        url: cur_url,
        success: function(data) {
          parser.call(self, data, function() {
            if (index == self.end) {
              status.call(self, "process complete successfully! " + self.counter + " pictures url collected!");
              if(self.onfinish) {
                self.onfinish();
              }
            } else if (!self.started) {
              status.call(self, "process stopped by user! " + self.counter + " pictures url collected!");
              if(self.onfinish) {
                self.onfinish();
              }
            } else {
              index++;
              cur_url = make_url.call(self, cur_url, index);
              iteration(cur_url, index);
            }
          });
        }
      });
    };

    this.run = function(begin, end, base_url) {
      this.counter = 0;
      this.begin = begin;
      this.end = end;
      this.started = true;
      iteration(base_url, begin);
    };

    this.stop = function() {
      this.started = false;
    };
  };

  var downloader = function(anchor_element, parser, make_url) {
    this.get_max_page_nums = get_max_page_nums;
    this.inject = function() {
      anchor_element.css("text-align", "left");
      insert_elements = '<TEXTAREA id="img_list" name="ImageURLs" rows="10" cols="80" readonly=true;></TEXTAREA><br>';
      insert_elements += '<input id="__Stop__" type="button" value="Stop" name="Stop" language="javascript" style="WIDTH: 231px; HEIGHT: 23px">';
      insert_elements += '<a>      from:</a><INPUT id="_sub_" type="text" name="sub" style="WIDTH: 170px" language="javascript" value="">';
      insert_elements += '<a>      to:</a><INPUT id="_upper_" type="text" name="_upper_" style="WIDTH: 170px" language="javascript" value=""><br>';
      insert_elements += '<input id="__Generate__" type="button" value="Generate" name="Generate" language="javascript" style="WIDTH: 231px; HEIGHT: 23px">';
      insert_elements += '<span id="processing"></span>';
      anchor_element[0].innerHTML = insert_elements;

      var list = $("#img_list");
      list.val("");
      var fetcher = new net_fetcher(parser, function(value) {
        if (value) {
          list.val(value);
        } else {
          return list.val();
        }
      },
      function(status) {
        $("#processing").text(status);
      },
      make_url, function() {});

      $("#__Stop__").click(function() {
        fetcher.stop();
      });

      $("#__Generate__").click(function() {
        var base_url = window.location.href;
        var max_page_num = get_max_page_nums();
        var begin = parseInt($("#_sub_").val());
        var end = parseInt($("#_upper_").val());

        if (isNaN(begin)) {
          begin = 1;
        }
        if (begin > max_page_num) {
          begin = max_page_num;
        }

        if (isNaN(end) || end > max_page_num) {
          end = max_page_num;
        }

        if (begin > end) {
          end = begin;
        }

        var cur = begin;

        fetcher.run(begin, end, base_url);
      });
    };
  };

  var make_url_pattern = function(url_page_num_pattern, index_modifier, default_query_index_param) {
    return function(cur_url, index) {
      if (null === cur_url.match(url_page_num_pattern)) {
        if (null !== cur_url.match(/\?/)) {
          cur_url += "&";
        } else {
          cur_url += "?";
        }
        cur_url += default_query_index_param;
      }
      return cur_url.replace(url_page_num_pattern, "$1" + index_modifier(index) + "$3");
    };
  };

  var make_url = make_url_pattern(/(\S*page=)([\d]+)(\S*)/g, function(i) {
    return i;
  },
  "page=1");

  var common_parser = function(parsing_pattern) {
    return function(data, finished) {
      var self = this;
      var urls = data.match(parsing_pattern);
      var parsed_urls = this.val();
      $.each(urls, function(i, url) {
        if (parsed_urls != "") {
          parsed_urls += "\n";
        }
        parsed_urls += url.replace(parsing_pattern, "$1");
        self.counter++;
      });
      this.val(parsed_urls);
      finished();
    };
  };

  var host = window.location.host;
  if (host === "danbooru.donmai.us") {
    var parer = common_parser(/"\s*file_url\s*"\s*:\s*"([^"]+)"/g);
    var danbooru = new downloader($("#upgrade-account"), parer, make_url);
    danbooru.inject();
  } else if (host === "moe.imouto.org") {
    var anchor = $("#header").append($("<div></div>"));
    var parer = common_parser(/"\s*jpeg_url\s*"\s*:\s*"([^"]+)"/g);
    var moe_imouto = new downloader(anchor, parer, make_url);
    moe_imouto.inject();
  } else if (host === "gelbooru.com" || host === "thedoujin.com") {
    var parser = function(data, finished) {
      var self = this;
      var parsing_pattern = /href="(index.php?[^"]*s=view[^"]+)"/g;
      var urls = data.match(parsing_pattern);
      var parsed_urls = [];
      $.each(urls, function(i, url) {
        parsed_urls.push(url.replace(parsing_pattern, "$1").replace(/&amp;/g, "&"));
      });

      var base_url = "http://" + window.location.host + "/";
      var fetcher = new net_fetcher(function(data, finished) {
        var regex = 'href="(http:\\/\\/[^"]+' + window.location.host.split(".").join("\\.") + '\\/\\/images[^"]+)"';
        var parsing_pattern = new RegExp(regex);
        var url = data.match(parsing_pattern);
        if(self.started) {
          var result = self.val();
          self.counter++;
          if(result) {
            result += "\n";
          }
          if(host === "thedoujin.com") {
            var page_num = "";
            for(var i = 0; i < 5 - self.counter.toString().length; ++i) {
              page_num += "0";
            }
            page_num += self.counter;
            url[1] = url[1] + "?/" + page_num + "." + url[1].split(".").pop();
          }
          result += url[1];
          self.val(result);
        } else {
          this.stop();
        }
        finished();
      },
      dummy, dummy, function(_, index) {
        if(self.started) {
          return base_url + parsed_urls[index];
        } else {
          this.stop();
        }
      });
      fetcher.onfinish = function() {
        finished();
      };
      fetcher.run(1, parsed_urls.length - 1, base_url + parsed_urls[0]);
    };

    make_url = make_url_pattern(/(\S*pid=)([\d]+)(\S*)/g, function(i) {
      return (i - 1) * 25
    },
    "pid=1");

    var content = $(".content");
    var anchor = $("<div></div>");
    var ads = $("iframe", content);
    if(ads.length !== 0) {
      //gelbooru post search result
      ads.remove();
      anchor.prependTo(content);
    } else if($("#adverti").length !== 0) {
      //thedoujin
      ads = $("#adverti");
      $("iframe", ads).remove();
      anchor.remove();
      anchor = ads;
    } else {
      //gelbooru pool
      anchor.prependTo($("#pool-show"));
    }
    var gelbooru = new downloader(anchor, parser, make_url);
    gelbooru.inject();
  }
}

