/*
 *author:chenjiajie
 *time:2017/10/16
 *description:数据双向绑定
 */

/*
 *desc：观察者模式,数据监控类，用于监控一个对象的内容是否变更,然后通知对应的观察者
  @param
  sub={
 	key："事件名称"//这里都是name.age.key这种属性格式
	actionList：回调函数
 }
 */
var Observer=function(opts){
	this.id=(opts&&opts.id)?opts.id:+new Date();
	this.opts=opts;
	this.subs=[];//观察者数组
}
Observer.prototype={

	monit:function(data,baseUrl){
		var me=this;
		baseUrl=baseUrl||"";
		var isTypeMatch=this.typeMatched(data);
		if(isTypeMatch){
			Object.keys(data).forEach(function(key){
				var base=baseUrl?(baseUrl+"."+key):key;
				me.defineKey(data,key,data[key],baseUrl);//定义自己
				me.monit(data[key],base);//递归【定义的是下一层】
			});
		}
	},

	defineKey:function(data,key,val,baseUrl){
		var me=this;
		var base=baseUrl?(baseUrl+"."+key):key;

		Object.defineProperty(data, key,{
			enumerable: true, 
            configurable: false,
            get: function() {
                return val;
            },
            set: function(newVal) {
                if (newVal !== val) {
                    val = newVal;
	                me.monit(newVal,base);//设置新值需要重新监控
	                me.publish(base);//(baseUrl+"."+key)作为观察者模式中的监听的那个key，也可以说是监听的那个事件
                }
            }
		});
	},

	typeMatched:function(data){
		return data&&typeof data === "object"
	},

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
  unfinish:组件化，组件中插入子组件
  @param
 	observe：new Observer(),//依赖观察者模式的对象
	data：数据，
	template：魔板，
	wrapper：数据放到哪个dom元素中去（是append进去）
  depend on： doT(https://github.com/olado/doT),依赖doT模板
 */
var Compile=function(opts){
	this.opts=opts;
	this.ele=(opts.wrapper&&this.isElement(opts.wrapper))?opts.wrapper:document.querySelector(opts.wrapper);//dom中已经存在的元素，这个元素作为容器
	if(this.ele){
		this.ele.appendChild(doT.compile(opts.template||"",opts.data));//渲染页面
		this.fragment=this.transToFrament(this.ele);
		this.travelAllNodes(this.fragment);
		this.ele.appendChild(this.fragment);
	}
	// opts&&opts.observer&&opts.observer.subscribe(key,this.update.bind(this,ele));
};
Compile.prototype={

	//遍历所有节点
	travelAllNodes:function(ele){
		var me=this;
		var childNodes=ele.childNodes;
		([].slice.call(childNodes)||[]).forEach(function(node){
			if(me.isElement(node)){
				me.compileElementNode(node);
			}else if(me.isText(node)){
				me.compileTextNode(node);
			}
			if(node.childNodes&&node.childNodes.length){
				me.compileElement(node);
			}
		});
			
	},

	//处理element类型的node节点
	compileElementNode:function(node){
		var me = this,nodeAttrs = node.attributes;
        [].slice.call(nodeAttrs).forEach(function(attr) {
            var attrName = attr.name;
            if (me.isDataBind(attrName)) {
                this.
            }else if(me.isHandlerBind(attrName)){

            }
        });
	},

	//处理text类型的node节点
	compileTextNode:function(ele){

	},

	//把原有节点转化成Frament节点，createDocumentFragment创建文档碎片节点，不会导致页面渲染，只有最后插入到文档时，才会渲染
	transToFrament:function(el) {
        var fragment = document.createDocumentFragment(), child;
        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }
        return fragment;
    },
    isElement:function(ele){
		return ele.nodeType===1?true:false;
	},
	isText:function(ele){
		return ele.nodeType===3?true:false;
	},

	isDataBind:function(attr){
		return attr==="v-data"?true:false;
	},

	isHandlerBind:function(attr){
		return attr==="v-event":true:false
	},
}

//learn from https://github.com/devil1989/mvvm