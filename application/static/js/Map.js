function Map(name, options){
    this.name = name;
    this.url = null;
    this.workspace = null;
    this.template = null;
    this.templateLocation = "";
    this.locationPassword = "";
    this.description = "";
    this.OLMap = null;
    this.WMSLayer = null;

    if(options){
        this.url = options.url ? options.url : this.url;
        this.workspace = options.workspace ? options.workspace : null;
        this.template = options.template ? options.template : this.template;
        this.templateLocation = options.templateLocation ? options.templateLocation : this.templateLocation;
        this.locationPassword = options.locationPassword ? options.locationPassword : this.locationPassword;
	this.description = options.description ? options.description : this.description;
        this.OLMap = options.OLMap ? options.OLMap : this.OLMap;
        this.WMSLayer = options.WMSLayer ? options.WMSLayer : this.WMSLayer;
    }
}

Map.prototype.create = function(workspace){
    var self = this;
    $.post($SCRIPT_ROOT + '/_create_map', {
        name: this.name,
        template: this.template,
        templatelocation: this.templateLocation,
        locationpassword: this.locationPassword,
        description: this.description
    }, function(status) {
        if(status == "1") {
            self.workspace.maps.push(self);
            self.workspace.displayMaps();
            
            self.open();
        }else {
            alert(status);
        }
    });
}

Map.prototype.open = function(){
    var self = this;
    $.post($SCRIPT_ROOT + '/_open_map', {
        name: this.name
    }, function(data) {
        if(typeof(data) == "object") {
	    $.each(data, function(key, element){
		self[key] = element;
	    });

            if(self.workspace.openedMap){
                self.workspace.openedMap.close();
            }

            self.workspace.openedMap = self;
            self.displayComponents();
            self.display();
            self.getResultingMapfile();

            $("#info").text(self.workspace.name + " / " + self.name);
        }else {
	    alert(data);
	}
    });
};

Map.prototype.getGroupByName = function(name){
    for(var i = 0; i < this.groups.length; i++){
	if(this.groups[i].name == name){
	    return this.groups[i];
	}
    }
    return null;
};

Map.prototype.getGroupIndexByName = function(name){
    for(var i = 0; i < this.groups.length; i++){
	if(this.groups[i].name == name){
	    return i;
	    break;
	}
    }
    return null;
};

Map.prototype.createGroup = function(name){
    var self = this;
    if(!this.getGroupByName(name)){
        $.post($SCRIPT_ROOT + '/_add_group', {
            name: name
        }, function(status) {
            if(status == 1){
                var group = {"name": name, "content": ""}
                self.groups.push(group);
                
                var groupSelect = $("#" + self.workspace.groupSelect);
                groupSelect.append($("<option></option>").attr("value", group.name).text(group.name));
            }           
        });       
    }
};

Map.prototype.removeGroup = function(name){
    var self = this;
    var group = this.getGroupByName(name);
    if(group){
        $.post($SCRIPT_ROOT + '/_remove_group', {
            name: name
        }, function(status) {
            if(status == 1){
                var index = self.getGroupIndexByName(name);
                self.groups.splice(index, 1);
                
                var groupSelect = $("#" + self.workspace.groupSelect);
                groupSelect.find("option[value='" + group.name + "']").remove();
                groupSelect.trigger("change");
            }
        });       
    }
};

Map.prototype.displayComponents = function(){
    mapEditor.setValue(this.map);
    scaleEditor.setValue(this.scales);
    variableEditor.setValue(this.variables);
    symbolEditor.setValue(this.symbols);
    fontEditor.setValue(this.fonts);
    projectionEditor.setValue(this.projections);

    this.displayGroups();
};

Map.prototype.displayGroups = function(){
    $(".group-button").button("enable");

    var groupSelect = $("#" + this.workspace.groupSelect);
    for(var i = 0; i < this.groups.length; i++){
        groupSelect.append($("<option></option>").attr("value", this.groups[i].name).text(this.groups[i].name));
    }
    var self = this;
    groupSelect.focus(function(e) {
        self.setGroupContent(this.value, groupEditor.getValue());
    }).change(function(e){
	var group = self.getGroupByName(this.value);
        if(group){
            groupEditor.setValue(group.content);
        } else{
            groupEditor.setValue("");
        }
        
	e.stopPropagation();
    }).trigger("change");
}

Map.prototype.displayDescription = function(){
    $("#" + this.workspace.mapDescription).empty();
    $("#" + this.workspace.mapDescription).append("<span class=\"underline\">Description</span>\n");
    $("#" + this.workspace.mapDescription).append("<textarea class=\"map-description\">" + this.description + "</textarea>");
    $("#" + this.workspace.mapDescription).append("<span class=\"underline\">URL</span>\n");
    $("#" + this.workspace.mapDescription).append("<textarea class=\"map-description\">" + this.url + "</textarea>");
    //$("#" + this.workspace.mapDescription).text(this.description);
};

Map.prototype.setGroupContent = function(name, content){
    var group = this.getGroupByName(name);
    if(group){
        group.content = content;
    }
};

Map.prototype.updateComponents = function(){
    this.setGroupContent($("#" + this.workspace.groupSelect).val(), groupEditor.getValue());
    this.map = mapEditor.getValue();
    this.scales = scaleEditor.getValue();
    this.variables = variableEditor.getValue();
    this.symbols = symbolEditor.getValue();
    this.fonts = fontEditor.getValue();
    this.projections = projectionEditor.getValue();     
}

Map.prototype.commit = function(){
    self = this;
    this.updateComponents();

    var data = JSON.stringify({
        map: this.map,
        scales: this.scales,
        variables: this.variables,
        symbols: this.symbols,
        fonts: this.fonts,
        projections: this.projections,
        groups: this.groups
    })

    $.ajax({
        url: $SCRIPT_ROOT + '/_commit',
        type: "POST",
        data: data,
        contentType:"application/json; charset=utf-8",
        dataType:"json",
        success: function(log) {
            $("#" + self.workspace.logTextarea).val(log["result"]);
            if(!self.WMSLayer){
                self.open();
            } else{
                self.WMSLayer.redraw(true);
            }
            self.getResultingMapfile();
        }
    })
}

Map.prototype.display = function(){
    if(this.errorMsg.length > 0){
        var error = "";
        for(var i = 0; i < this.errorMsg.length; i++){
            error += this.errorMsg[i] + "\n";
        }
        $("#" + this.workspace.logTextarea).val(error);
    } else{
        var scales = [];
        for(i in this.OLScales){
            scales[i] = Math.ceil(parseInt(this.OLScales[i])/10) * 10;
        }

        var extent = this.OLExtent.split(" ");

        if(this.OLUnits == "meters"){
            units = "m";
        } else if(this.OLUnits == "dd"){
            units= "d";
        }

        var mapOptions = {
            allOverlays: true,
            projection: new OpenLayers.Projection(this.OLProjection),
            maxExtent: extent,
            maxResolution: scales[1],
            scales:  scales,
            units: units
        };

        var OLMap = new OpenLayers.Map(this.workspace.mapDiv, mapOptions);
        OLMap.addControls([new OpenLayers.Control.Scale(), new OpenLayers.Control.MousePosition()]);

        var WMSLayer = new OpenLayers.Layer.WMS(
            this.name,
            this.url,
            {
                layers: "default",
                format: "image/png"
            }, {
                singleTile: true,
                projection: new OpenLayers.Projection(this.OLProjection)
            }
        );

        OLMap.addLayers([WMSLayer]);
        OLMap.zoomToMaxExtent();
        
        this.OLMap = OLMap;
        this.WMSLayer = WMSLayer;

        this.registerScaleLevel();
        this.displayScaleLevel();
    }
}

Map.prototype.close = function(){
    if(this.OLMap){
        this.OLMap.destroy();
    }

    this.closeDataBrowser();
    this.clearGroups();

    this.clearComponents();
    this.workspace.openedMap = null;
}

Map.prototype.clearGroups = function(){
    var groupSelect = $("#" + this.workspace.groupSelect);
    groupSelect.find("option").remove();
    groupSelect.unbind("focus");
    groupSelect.unbind("change");
}

Map.prototype.destroy = function(callback){
    var self = this;
    $.post($SCRIPT_ROOT + '/_delete_map', {
        name: this.name
    }, function(status) {
        if(status == "1") {
            $("#" + self.workspace.mapTable + " td.map-selected").remove();
            $("#" + self.workspace.mapDescription).html("");
            var index = self.workspace.getMapIndexByName(name);
            self.workspace.maps.splice(index - 1, 1);

            if(callback){
                callback.call(self);
            }
        }else {
            alert(status);
        }
    });   
}

Map.prototype.clearComponents = function(){
    groupEditor.setValue("");
    mapEditor.setValue("");
    scaleEditor.setValue("");
    variableEditor.setValue("");
    symbolEditor.setValue("");
    fontEditor.setValue("");
    projectionEditor.setValue("");
};

Map.prototype.displayGroupsIndex = function(){
    $("#" + this.workspace.groupTable).find("tr").remove();

    var data = ""
    for(var i = 0; i < this.groups.length; i++){
	data += "<tr><td class=\"map-td\">" + this.groups[i].name + "</td></tr>";
    }
    $("#" + this.workspace.groupTable + " > tbody:last").append(data);

    var self = this;
    $("#" + this.workspace.groupTable + " td").click(function(e){
	$("#" + self.workspace.groupTable + " td").removeClass("map-selected");
	$(this).addClass("map-selected");

	e.stopPropagation();
    });
}

Map.prototype.raiseGroupIndex = function(name){
    var index = this.getGroupIndexByName(name);
    var group = this.getGroupByName(name);
    var bumpedGroup = this.groups[index - 1];

    if(index > 0){
        this.groups.splice(index - 1, 1, group);
        this.groups.splice(index, 1, bumpedGroup);
    }
}

Map.prototype.lowerGroupIndex = function(name){
    var index = this.getGroupIndexByName(name);
    var group = this.getGroupByName(name);
    var bumpedGroup = this.groups[index + 1];

    if(index < this.groups.length){
        this.groups.splice(index + 1, 1, group);
        this.groups.splice(index, 1, bumpedGroup);
    }
}

Map.prototype.updateGroupOrder = function(){
    var self = this;
    var data = [];
    for(var i = 0; i < this.groups.length; i++){
        data.push(this.groups[i].name);
    }
    data = JSON.stringify(data);

    $.ajax({
        url: $SCRIPT_ROOT + '/_change_groups_index',
        type: "POST",
        data: data,
        contentType:"application/json; charset=utf-8",
        dataType:"json",
        success: function(status) {
            var selected = $("#" + self.workspace.groupSelect).val();
            var content = groupEditor.getValue();
            self.clearGroups();
            self.displayGroups(true);
            $("#" + self.workspace.groupSelect).val(selected);
            groupEditor.setValue(content);
            self.commit();
        }
    })
}

Map.prototype.openDataBrowser = function(){
    var newDivName = "data-browser-child-" + this.name;
    $("#" + this.workspace.dataDiv).append($("<div>").attr("id", newDivName));
    $("#" + newDivName).elfinder({
	url: '/cgi-bin/elfinder-python/connector-' + this.workspace.name + '-' + this.name + '.py',
        transport : new elFinderSupportVer1(),
        cssClass: 'file-manager',
        resizable: false,
        commands: [
	    'open', 'reload', 'home', 'up', 'back', 'forward', 'getfile', 
	    'rename', 'mkdir', 'mkfile', 'copy', 'paste', 'help', 'rm',
	    'sort', 'tree', 'upload', 'extract', 'archive', 'view'
        ]
    }).elfinder('instance');

    $("#" + this.workspace.dataDiv).trigger("resize");
}

Map.prototype.closeDataBrowser = function(){ 
    if($("#" + this.workspace.dataDiv).children().length > 0){
        $("#data-browser-child-" + this.name).elfinder('destroy');
        $("#data-browser-child-" + this.name).remove();
    }
}

Map.prototype.backup = function(){
    //Utiliser la fonction de clonage développée à la FADQ
}

Map.prototype.exportSelf = function(){

}

Map.prototype.getResultingMapfile = function(){
    var self = this;
    $.getJSON($SCRIPT_ROOT + '/_load_mapfile_generated', {
	mapToEdit: this.name
    }, function(data) {
        $("#" + self.workspace.resultTextarea).val(data["text"]);
    });
}

Map.prototype.getDebug = function(){
    var self = this;
    $.getJSON($SCRIPT_ROOT + '/_load_debug', {
    }, function(data) {
	$("#" + self.workspace.debugTextarea).val(data.text);
    });	
}

Map.prototype.registerScaleLevel = function(){
    var self = this;
    this.OLMap.events.on({
	"zoomend": function(){
            self.displayScaleLevel();
        }
    });
}

Map.prototype.displayScaleLevel = function(){
    var zoom = this.OLMap.zoom + 1;
    $("#" + this.workspace.scaleLevelDiv).html("Scale level: " + zoom);
}