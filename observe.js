/*
 *desc：数据监控类，用于监控一个对象的内容是否变更
 *@param
 	observe：new Observer(),//依赖观察者模式的对象
 */
var Supervisor=function(opts){
	this.id=(opts&&opts.id)?opts.id:+new Date();
	this.opts=opts;
}
Supervisor.prototype={

	monitor:function(data,baseUrl){
		var me=this;
		baseUrl=baseUrl||"";
		var isTypeMatch=this.typeMatched(data);
		if(isTypeMatch){
			Object.keys(data).forEach(function(key){
				var base=baseUrl?(baseUrl+"."+key):key;
				me.defineKey(data,key,data[key],baseUrl);//定义自己
				me.monitor(data[key],base);//递归【定义的是下一层】
			});
		}
	},

	defineKey:function(data,key,val,baseUrl){
		var me=this;
		var base=baseUrl?(baseUrl+"."+key):key;
		var observer=this.opts?this.opts.observer:null;

		Object.defineProperty(data, key,{
			enumerable: true, 
            configurable: false,
            get: function() {
                return val;
            },
            set: function(newVal) {
                if (newVal !== val) {
                    val = newVal;
	                me.monitor(newVal,base);//设置新值需要重新监控
	                observer&&observer.publish(base);//(baseUrl+"."+key)作为观察者模式中的监听的那个key，也可以说是监听的那个事件
                }
            }
		});
	},

	typeMatched:function(data){
		return data&&typeof data === "object"
	}
};

/*
 *desc：观察者模式,连接Supervisor和Compiler
 @param
  sub={
 	key："事件名称"//这里都是name.age.key这种属性格式
	actionList：回调函数
 }
 */
var Observer=function(opts){
	this.id=(opts&&opts.id)?opts.id:+new Date();
	this.opts=opts;
	this.subs=[];
};
Observer.prototype={

	//发布
	publish:function(actionType){
		(this.subs||[]).forEach(function(sub){
			if(sub.key==actionType){
				(sub.actionList||[]).forEach(function (action) {
					action();
				});
			}
		});
	},

	//订阅
	subscribe:function(key,callback){
		var tgIdx;
		var hasExist=this.subs.some(function(unit,idx){
			tgIdx=(unit.key===key)?idx:-1;
			return (unit.key===key)
		});
		if(hasExist){
			if(Object.prototype.toString.call(this.subs[tgIdx].actionList)==="[object Array]"){
				this.subs[tgIdx].actionList.push(callback);
			}else{
				this.subs[tgIdx].actionList=[callback];
			}
		}else{
			this.subs.push({
				key:key,
				actionList:[callback]
			});
		}
	},

	//取消订阅
	remove:function(key){
		var removeIdx;
		this.subs.forEach(function (sub,idx) {
			removeIdx=sub.key===key?idx:-1;
			return sub.key===key
		});
		if(removeIdx!==-1){
			this.subs.splice(removeIdx,1);
		}
	}
};


/*
 *desc：模板编译器，处理模板，把模板转义为dom，同事添加观察者（dom元素）的事件订阅：subscribe
 @param
 	observe：new Observer(),//依赖观察者模式的对象
 */
var Compile=function(opts){
	this.opts=opts;
	// opts&&opts.observer&&opts.observer.subscribe(key,this.update.bind(this,ele));
};
Compile.prototype={
	update:function(ele){

	},

	//把原有节点转化成Frament节点，createDocumentFragment创建文档碎片节点，不会导致页面渲染，只有最后插入到文档时，才会渲染
	transToFrament:function(el) {
        var fragment = document.createDocumentFragment(), child;
        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }
        return fragment;
    }
}

//learn from https://github.com/devil1989/mvvm